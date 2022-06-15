import type { Token, TokenType, ValueToken } from './tokenizer';
import type { PrimaryHook } from './expression';

export interface OperationsTree {
    [operation : string | symbol] : OperationsTree | OperationsTree[] | RightValue
}

// TODO: manage types

export type ParserOps = { [operation : string] : symbol };
type LeftValue = string;
export type RightValue = string | null | number | RightValue[];


class ParsingContext {
        
    public tokens : Token[];
    public state : {pos : number, tPos : number, length : number }
    
    constructor( tokenList : Token[] ) {
        this.tokens = tokenList;
        this.state = {
            pos : 0,
            tPos : 0,
            length : tokenList.length,
        }
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
        // TODO: proper error handling
        throw new Error('Parsing error: Invalid token state');
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

    public parse( tokenList : Token[] ) {
        
        // ------------------------------------

        // TODO: Improve syntax for null, add numbers and SQL regex expressions without literals

        /*
        *   <expression> ::= <andBinary>
        *                   
        *   <orBinary> ::= <andBinary> ( <or> <andBinary> )*
        *   <andBinary> ::= <unary> ( <and> <unary> )*
        *   <unary> ::= <not> <unary> | <primary>
        *   <primary> ::= <leftValue> <operator> <rightValue> | "(" <expression> ")"
        *                   
        *   <literalValue> ::= "\"val" ([0-9]) "\""
        *   <value> ::= "val" ([0-9])
        *   <numbeer> ::= ([0-9]*.?[0-9]*)
        *
        *                   
        *   <and> ::= "&" | "AND" | "and" | ","
        *   <or> ::= "|" | "OR" | "or"
        *   <not> ::= "!" | "NOT" | "not"
        *                   
        *   <operator> ::= "==" | "!=" | "<" | ">" | "<=" | "EQ" | "eq" | "lt" | "LT" | <value>
        *   <rightValue> ::= <value> | <array> | <literalValue> | "null" | <number>
        *   <leftValue> ::= <value> | <literalValue>
        *   <array> ::= "[" ( (<rightValue>) ("," (<rightValue>))* (",")? )? "]"
        * 
        */

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
                if(!c.advanceIfMatch('RIGHT_PAR')) throw new Error('Parsing error: Expected closing ) value');
                return exp;
            }

            // Left value
            const lValue = leftValue();
            const op = operator();
            const rValue = rightValue();

            const primary = { [lValue] : { [op] : rValue } };
            
            const hookResult = hooks.primary( { lValue, operator : op, rValue } );            
            if(typeof hookResult === 'boolean') return hookResult ? primary : {};            

            return hookResult;
        }

        

        // TODO: update this definition as it doesn't accept null
        // <leftValue> ::= <value> | <literalValue>
        function leftValue() : string {
            if(c.isCurrentMatch('LITERAL_VALUE')) {            
                const leftToken = c.getCurrentAndAdvance();
                
                // TODO: proper error handling
                if(!c.isValueToken(leftToken)) throw new Error('Parsing error: Expected value in leftValue');
                
                // OPTIMIZATION: maybe cast / assert only
                if(leftToken.value === null) throw new Error('Parsing error: Expected value in leftValue, got null'); // This error would never happen
                if(typeof leftToken.value === 'number') throw new Error('Parsing error: Expected string value in leftValue, got number'); // This error would never happen

                return leftToken.value;
            }

            const v = value();
            if(v === null) throw new Error('Parsing error: Expected value in leftValue, got null');

            return v;
        }
        
        function value() : string | null {
            const valueToken = c.getCurrentAndAdvance()
            // TODO: proper error handling
            if(valueToken.type !== 'IDENTIFIER') throw new Error('Parsing error: Expected identifier in value');
            if(!c.isValueToken(valueToken)) throw new Error('Parsing error: Expected value in identifier value');
            if(typeof valueToken.value === 'number') throw new Error('Parsing error: Expected non number value in identifier');
            return valueToken.value;
        }

        // <rightValue> ::= <value> | <array> | <literalValue>
        function rightValue() : RightValue {
            
            if(c.advanceIfMatch('LEFT_BRACKET')) {
                return array();
            }
            
            if(c.isCurrentMatch('LITERAL_VALUE')) {
                const rValue = c.getCurrentAndAdvance();
                // TODO: proper error handling
                if(!c.isValueToken(rValue)) throw new Error('Parsing error: Expected value in literal rightValue');
                return rValue.value;
            }

            if(c.isCurrentMatch('NUMBER')) {
                const rValue = c.getCurrentAndAdvance();
                // TODO: proper error handling
                if(!c.isValueToken(rValue)) throw new Error('Parsing error: Expected value in number rightValue');
                return rValue.value
            }

            return value();
        }

        // <array> ::= "[" ( (<rightValue>) ("," (<rightValue>))* (",")? )? "]"
        function array() : RightValue[] {
            const arr : RightValue[] = [];

            // [ already consumed
            while(!c.isCurrentMatch('RIGHT_BRACKET') && !c.isAtEnd()){
                arr.push( rightValue() );
                if(!c.advanceIfMatch('COMMA')) break;
            }
            if(!c.advanceIfMatch('RIGHT_BRACKET')) throw new Error('Parsing error: Expected closing ] in array');

            return arr;
        }

        // <operator> ::= "==" | "!=" | "<" | ">" | "<=" | "EQ" | "eq" | "lt" | "LT" | <value>
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
                    if(!c.isValueToken(operator)) throw new Error('Parsing error: Expected value in operator');
                    if(operator.value === null) throw new Error('Parsing error: Expected value for operator, got null');
                    if(typeof operator.value === 'number' ) throw new Error('Parsing error: Invalid value for operator, got number');
                    op = operator.value.toLowerCase(); break;
                default:
                    throw new Error('Parsing error: Unidentified token in operator');
            }

            // TODO: proper error handling
            if(typeof Ops[op] === 'undefined') throw new Error('Parsing error: Could not resolve operator');

            return Ops[op];

        }

        const exp = expression();
        if(!c.advanceIfMatch('END')) throw new Error('Parsing error: Expected end of expression');

        return exp;

    }

}