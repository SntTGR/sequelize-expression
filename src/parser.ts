import type { NumberToken, StringToken, Token, TokenType, ValueToken } from './tokenizer';
import type { PrimaryHook } from './expression';
import { ErrorBundle, ExpressionError, ExpressionResult } from './errors';

export interface OperationsTree {
    [operation : string | symbol] : OperationsTree | OperationsTree[] | RightValue
}

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
    }
}

// TODO: manage types

export type ParserOps = { [operation : string] : symbol };
type LeftValue = string;
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

    newParserHardError(message: string, token? : Token) {
        this.newParserSoftError(message, token);
        return new PanicNotation();
    }

    newParserSoftError(message: string, token? : Token) {
        
        const posToken = token ? token : this.getCurrentToken();
        
        let start = posToken.position ? posToken.position.start : 0;
        let end = posToken.position ? posToken.position.end : 0;
        
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
    
    private Ops : ParserOps = {}
    private hooks : { primary : PrimaryHook } = { primary : () => true }

    constructor( ops : ParserOps, hooks? : { primary : PrimaryHook }  ) {
        this.Ops = ops;
        if (hooks) {
            this.hooks = hooks;
        }
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

        const Ops = this.Ops;
        const hooks = this.hooks;
        const c = new ParsingContext(tokenList);

        // <expression> ::= <andBinary>
        function expression() : OperationsTree {
            return orBinary();
        }

        // <orBinary> ::= <andBinary> ( <or> <andBinary> )*
        function orBinary() : OperationsTree {
            const lUnary = andBinary();
            const orGenerator = { [Ops.or] : [lUnary] };
            while (c.advanceIfMatch('OR')) {
                orGenerator[Ops.or].push(andBinary());
            }
            return orGenerator[Ops.or].length === 1 ? lUnary : orGenerator;
        }

        // <andBinary> ::= <unary> ( <and> <unary> )*
        function andBinary() : OperationsTree {
            const lOrBinary = unary();
            const andGenerator = { [Ops.and] : [lOrBinary] };
            while(c.advanceIfMatch( 'AND', 'COMMA' )) {
                andGenerator[Ops.and].push(unary());
            }
            return andGenerator[Ops.and].length === 1 ? lOrBinary : andGenerator;
        }

        // <unary> ::= <not> <unary> | <primary>
        function unary() : OperationsTree {
            if (c.advanceIfMatch('NOT')) {
                return { [Ops.not] : unary() };
            }
            return primary();
        }

        // <primary> ::= <leftValue> <operator> <rightValue> | "(" <expression> ")"
        function primary() : OperationsTree {
            
            if(c.advanceIfMatch('LEFT_PAR')) {
                const exp = expression();
                if(!c.advanceIfMatch('RIGHT_PAR')) c.newParserSoftError('Expected closing ) value');
                return exp;
            }

            const lValue = leftValue();
            const op = operator();
            const rValue = rightValue();

            const primary = { [lValue] : { [op] : rValue } };
            
            // TODO: Simplify hooks API
            const hookResult = hooks.primary( { lValue, operator : op, rValue } );
            if(typeof hookResult === 'boolean') return hookResult ? primary : {};

            return hookResult;
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

            // TODO: Operator hook?
            if(typeof Ops[op] === 'undefined') {
                c.newParserSoftError(`Could not resolve operator: ${op}`, c.getPreviousToken());
                return Symbol('noop');
            }

            return Ops[op];
        }

        let exp;

        try {
            
            exp = expression();
            if(!c.advanceIfMatch('END')) throw c.newParserHardError('Expected end of expression');
            
        } catch (error) {
            
            if(error instanceof PanicNotation) return new ExpressionResult<OperationsTree>(c.bundleErrors()) 
            else throw error;
        }

        return new ExpressionResult(c.hasErrors() ? c.bundleErrors() : exp);

    }

}