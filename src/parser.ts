import type { NumberToken, StringToken, Token, TokenType, ValueToken } from './tokenizer';
import type { Hooks } from './expression';

import { ErrorBundle, ExpressionError, ExpressionResult } from './errors';


export class ParserError extends ExpressionError {
    constructor(message : string, position : number, length : number){
        super(message, position, length)
        Object.setPrototypeOf(this, ParserError.prototype);
        this.name = this.constructor.name;
    }
}

export class PanicNotation extends Error {    
    constructor() {
        super();
        Object.setPrototypeOf(this, PanicNotation.prototype);
        this.name = this.constructor.name;
    }
}

export interface OperationsTree { [operation : string | symbol] : OperationsTree | OperationsTree[] | RightValue }
export type ParserOps = { [operation : string] : symbol };

export type Operator = symbol;
export type LeftValue = string;
export type RightValue = string | null | number | RightValue[];

class ParsingContext {
        
    public tokens : Token[];
    public state : {pos : number, tPos : number, length : number }

    private errors : ParserError[] = [];
    
    constructor( tokenList : Token[] ) {
        this.tokens = tokenList;
        this.state = {
            pos : 0,
            tPos : 0,
            length : tokenList.length,
        }
    }

    hasErrors() : boolean {
        return this.errors.length > 0;
    }

    bundleErrors() : ErrorBundle {
        return new ErrorBundle(this.errors);
    }

    newParserHardError(message: string, token? : Token | Token[]) {
        this.newParserSoftError(message, token);
        return new PanicNotation();
    }

    newParserSoftError(message: string, token? : Token | Token[]) {
        
        let start : number = 0; 
        let end : number = 0;

        if(token) {
            if(Array.isArray(token)){
                
                let min = Number.MAX_SAFE_INTEGER;
                let max = 0;
    
                token.forEach( (t) => {
                    min = t.position && t.position.start < min ? t.position.start : min;
                    max = t.position && t.position.end > max ? t.position.end : max;
                })

                start = min;
                end = max === Number.MAX_SAFE_INTEGER ? 0 : max;
            } else {
                start = token.position ? token.position.start : 0;
                end = token.position ? token.position.end : 0; 
            }

        } else {
            start = 0;
            end = 0;            
        }
        
        this.errors.push(new ParserError(message, start, end - start + 1 ));
    }

    isAtEnd() : boolean {
        return this.state.pos >= this.state.length;
    }
    isCurrentMatch(type : TokenType) : boolean {
        if(this.isAtEnd()) return false;
        
        return this.getCurrentTokenType() === type;
    }
    getCurrentToken() : Token {
        if (!this.isAtEnd()) {
            return this.tokens[this.state.pos];
        }
        throw new Error('Trying to read past end of tokens');
    }
    getPreviousToken() : Token {
        if(this.state.pos <= 0) throw new Error('Trying to read token before first one');
        return this.tokens[this.state.pos-1];
    }

    getCurrentTokenType() : TokenType {
        return this.getCurrentToken().type;
    }
    advanceIfMatch( ...types : TokenType[] ) : boolean {
        for (const type of types) {
            if (this.isCurrentMatch(type)) {
                this.getCurrentAndAdvance();
                return true;
            }
        }
        return false
    }
    getCurrentAndAdvance() : Token {
        return this.tokens[this.state.pos++];
    }
    // TODO: Read up on type guards
    isValueToken(token : Token) : token is ValueToken {
        return 'value' in token;
    }
    isStringToken(token : Token) : token is StringToken {
        return typeof (token as StringToken).value === 'string';
    }
    isNumberToken(token : Token) : token is NumberToken {
        return typeof (token as NumberToken).value === 'number';
    }
}

export class Parser {
    
    private _hooks : Hooks;

    constructor(hooks : Hooks ) {
        this._hooks = hooks;
    }

    private _operatorMemory : { [op : string] : symbol } = {};
    private memoizedOperator(op : string, operatorResolver : () => symbol ) : symbol {
        if (!this._operatorMemory[op]) this._operatorMemory[op] = operatorResolver();
        return this._operatorMemory[op];
    }

    public set hooks( hooks : Hooks ) {
        this._operatorMemory = {};
        this._hooks = hooks;
    }

    public parse( tokenList : Token[] ) : ExpressionResult<OperationsTree> {
        
        // /* ------------- Expressions ------------ */
        //    
        //      <expression> ::= <orBinary>
        //      <orBinary> ::= <andBinary> ( <or> <andBinary> )*
        //      <andBinary> ::= <unary> ( <and> <unary> )*
        //      <unary> ::= <not> <unary> | <primary>
        //      <primary> ::= <leftValue> <operator> <rightValue> | "(" <expression> ")"
        //
        // /* ------------- Value Types ------------ */
        //
        //      <literalValue> ::= "\"val" ([0-9]) "\""
        //      <identifier> ::= "val" ([0-9] | [a-z] | [A-Z] | "." | "_" | "-" | "%" )+    /* should be separated by non identifier valid characters */ 
        //      <number> ::= ("-")? ([0-9])+ ("." ([0-9])+ )?                               /* number takes precedence if identifier has only number valid characters */ 
        //      <null> ::= "null"
        //
        // /* ------------ Required Operators ------ */
        //
        //      <and> ::= "&" | "AND" | "and" | ","
        //      <or> ::= "|" | "OR" | "or"
        //      <not> ::= "!" | "NOT" | "not"
        //      
        //      <gt> ::= ">" | "gt"  | "GT"
        //      <lt> ::= "<" | "lt" | "LT"
        //      <eq> ::= "=" | "eq" | "EQ"
        //      <ne> ::= "!=" | "ne" | "NE"
        //      <gte> ::= ">=" | "gte" | "GTE"
        //      <lte> ::= "<=" | "lte" | "LTE"
        //
        // /* ------------- Value Groups ------------- */
        //
        //      <operator> ::= <gt> | <lt> | <eq> | <ne> | <gte> | <lte> | <identifier>
        //      <rightValue> ::= <identifier> | <literalValue> | <number> | <array> | <null>
        //      <leftValue> ::= <identifier> | <literalValue>
        //      <array> ::= "[" ( (<rightValue>) (("," | ";") (<rightValue>))* ("," | ";")? )? "]"
        //
        // /* ---------------------------------------- */

        const c = new ParsingContext(tokenList);
        const hooks = this._hooks;
        const memoizedOperatorGenerator = (op : string, token : Token) => this.memoizedOperator(op, this._hooks.operator.bind(null, op, (message) => c.newParserHardError(message, token)));

        // <expression> ::= <andBinary>
        function expression() : OperationsTree | null {
            return orBinary();
        }

        // <orBinary> ::= <andBinary> ( <or> <andBinary> )*
        function orBinary() : OperationsTree | null {
            const orGenerator = [andBinary()];

            let lastOrToken : any; // Token

            while (c.advanceIfMatch('OR')) {
                lastOrToken = c.getPreviousToken();
                orGenerator.push(andBinary());
            }

            const validOrGenerator = orGenerator.filter( and => and != null ) as OperationsTree[]

            if(validOrGenerator.length > 1) {
                const orSymbol = memoizedOperatorGenerator('or', lastOrToken);
                return { [orSymbol] : validOrGenerator };
            }
            
            if(validOrGenerator.length === 1) return validOrGenerator[0];
            
            return null;
        }

        // <andBinary> ::= <unary> ( <and> <unary> )*
        function andBinary() : OperationsTree | null {
            const andGenerator = [unary()];

            let lastAndToken : any; // Token

            while (c.advanceIfMatch('AND', 'COMMA')) {
                lastAndToken = c.getPreviousToken();
                andGenerator.push(unary());
            }

            const validAndGenerator = andGenerator.filter( un => un != null ) as OperationsTree[]

            if(validAndGenerator.length > 1) {
                const andSymbol = memoizedOperatorGenerator('and', lastAndToken);
                return { [andSymbol] : validAndGenerator };
            }
            
            if(validAndGenerator.length === 1) return validAndGenerator[0];
            
            return null;
        }

        // <unary> ::= <not> <unary> | <primary>
        function unary() : OperationsTree | null {
            if (c.advanceIfMatch('NOT')) {
                const notSymbol = memoizedOperatorGenerator('not', c.getPreviousToken());
                const un = unary();
                return un != null ? { [notSymbol] : un } : null
            }

            return primary();
        }

        // <primary> ::= <leftValue> <operator> <rightValue> | "(" <expression> ")"
        function primary() : OperationsTree | null {
            
            if(c.advanceIfMatch('LEFT_PAR')) {
                const exp = expression();
                if(!c.advanceIfMatch('RIGHT_PAR')) c.newParserSoftError('Expected closing ) value');
                return exp;
            }

            const primaryFirstToken = c.getCurrentToken();

            const lValue = leftValue();
            const op = operator();
            const rValue = rightValue();

            const primaryLastToken = c.getPreviousToken();

            const err = (message : string) => c.newParserHardError(message, [primaryFirstToken, primaryLastToken])
            const primary = hooks.primary( { lValue, operator : op, rValue}, err);
            
            return primary ? primary : null;
        }

        // <leftValue> ::= <identifier> | <literalValue>
        function leftValue() : string {
            if(c.isCurrentMatch('LITERAL_VALUE')) {
                const leftToken = c.getCurrentAndAdvance();
                if(!c.isStringToken(leftToken)) throw c.newParserHardError('Expected string in leftValue', c.getPreviousToken());
                return leftToken.value;
            }

            const idValue = identifier();
            if(idValue === null) { c.newParserSoftError('Parsing error: Expected value in leftValue, got null', c.getPreviousToken()); return 'noop' }

            return idValue;
        }

        // <identifier> ::= "val" ([0-9] | [a-z] | [A-Z] | "." | "_" | "-" | "%" )+    /* should be separated by non identifier valid characters */ 
        function identifier() : string {
            const valueToken = c.getCurrentAndAdvance()
            if(valueToken.type !== 'IDENTIFIER') { c.newParserSoftError('Expected an identifier', c.getPreviousToken()); return '__nullIdentifier'; }
            if(!c.isStringToken(valueToken)) throw c.newParserHardError('Expected a string in type identifier', c.getPreviousToken());

            return valueToken.value;
        }

        // <rightValue> ::= <identifier> | <literalValue> | <number> | <array> | <null>
        function rightValue() : RightValue {
            
            if(c.advanceIfMatch('LEFT_BRACKET')) {
                return array();
            }
            
            if(c.isCurrentMatch('LITERAL_VALUE')) {
                const rValue = c.getCurrentAndAdvance();
                if(!c.isStringToken(rValue)) throw c.newParserHardError('Expected a string in type literal of rightValue', c.getPreviousToken());
                return rValue.value;
            }

            if(c.isCurrentMatch('NUMBER')) {
                const rValue = c.getCurrentAndAdvance();
                if(!c.isNumberToken(rValue)) throw c.newParserHardError('Expected a number in type number of rightValue', c.getPreviousToken());
                return rValue.value
            }

            if(c.isCurrentMatch('NULL')) {
                return null;
            }

            return identifier();
        }

        // <array> ::= "[" ( (<rightValue>) (("," | ";") (<rightValue>))* ("," | ";")? )? "]"
        function array() : RightValue[] {
            const arr : RightValue[] = [];

            // [ already consumed
            while(!c.isCurrentMatch('RIGHT_BRACKET') && !c.isCurrentMatch('END') && !c.isAtEnd()){
                arr.push( rightValue() );
                if(!c.advanceIfMatch('COMMA', 'SEMICOLON')) break;
            }

            if(!c.advanceIfMatch('RIGHT_BRACKET')) { c.newParserSoftError('Expected closing ]'); return [] }

            return arr;
        }

        // <operator> ::= <gt> | <lt> | <eq> | <ne> | <gte> | <lte> | <identifier>
        function operator() : ParserOps[string] {
            const operator = c.getCurrentAndAdvance();

            let op : string;

            switch (operator.type) {
                case 'GT': op = 'gt'; break;
                case 'LT': op = 'lt'; break;
                case 'EQ': op = 'eq'; break;
                case 'NE': op = 'ne'; break;
                case 'GTE': op = 'gte'; break;
                case 'LTE': op = 'lte'; break;
                case 'IDENTIFIER':
                    if(!c.isStringToken(operator)) throw c.newParserHardError('Expected string in operator', c.getPreviousToken())
                    op = operator.value.toLowerCase(); break;
                default:
                    throw c.newParserHardError(`Unexpected token type of ${operator.type} in operator`, c.getPreviousToken());
            }

            const opSymbol = memoizedOperatorGenerator(op, c.getPreviousToken());

            return opSymbol;
        }

        let exp;

        try {
            
            exp = expression();
            if(!c.advanceIfMatch('END')) throw c.newParserHardError('Expected end of expression', c.getCurrentToken());
            
        } catch (error) {
            
            if(error instanceof PanicNotation) return new ExpressionResult<OperationsTree>(c.bundleErrors()) 
            else throw error;
        }

        return new ExpressionResult(c.hasErrors() ? c.bundleErrors() : exp ? exp : {});

    }

}