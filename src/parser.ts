import type { Token, TokenType, ValueToken } from './tokenizer';

export interface OperationsTree {
    [operation : string] : OperationsTree | RightValue
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

    constructor( ops : ParserOps ) {
        this.Ops = ops;
    }

    public parse( tokenList : Token[] ) {
        
        // ------------------------------------

        // TODO: Improve syntax for null, add numbers and SQL regex expressions without literals

        /*
        *   <expression> ::= <andBinary>
        *                   
        *   <andBinary> ::= <orBinary> ( <and> <orBinary> )*
        *   <orBinary> ::= <unary> ( <or> <unary> )*
        *   <unary> ::= <not> <unary> | <primary>
        *   <primary> ::= <leftValue> <operator> <rightValue> | "(" <expression> ")"
        *                   
        *   <literalValue> ::= "\"val" ([0-9]) "\""
        *   <value> ::= "val" ([0-9])
        *                   
        *   <and> ::= "&" | "AND" | "and" | ","
        *   <or> ::= "|" | "OR" | "or"
        *   <not> ::= "!" | "NOT" | "not"
        *                   
        *   <operator> ::= "==" | "!=" | "<" | ">" | "<=" | "EQ" | "eq" | "lt" | "LT" | <value>
        *   <rightValue> ::= <value> | <array> | <literalValue>
        *   <leftValue> ::= <value> | <literalValue>
        *   <array> ::= "[" ( (<rightValue>) ("," (<rightValue>))* (",")? )? "]"
        * 
        */

        const Ops = this.Ops;
        const c = new ParsingContext(tokenList);

        // <expression> ::= <andBinary>
        function expression() : OperationsTree {
            return andBinary();
        }

        // <andBinary> ::= <orBinary> ( <and> <orBinary> )*
        function andBinary() : OperationsTree {
            const lOrBinary = orBinary();
            const andGenerator = { [Ops.and] : [lOrBinary] };
            while(c.advanceIfMatch( 'AND', 'COMMA' )) {
                andGenerator[Ops.and].push(orBinary());
            }
            return andGenerator[Ops.and].length === 1 ? lOrBinary : andGenerator;
        }

        // <orBinary> ::= <unary> ( <or> <unary> )*
        function orBinary() : OperationsTree {
            const lUnary = unary();
            const orGenerator = { [Ops.or] : [lUnary] };
            while (c.advanceIfMatch('OR')) {
                orGenerator[Ops.or].push(unary());
            }
            return orGenerator[Ops.or].length === 1 ? lUnary : orGenerator;
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

            return { [lValue] : { [op] : rValue } };
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
                const rValue = array();
                // TODO: proper error handling
                if(!c.advanceIfMatch('RIGHT_BRACKET')) throw new Error('Parsing error: Expected closing ] in rightValue');
                return rValue;
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
                
                if(c.advanceIfMatch('COMMA')) continue;
                break;
            }

            c.advanceIfMatch('COMMA') // trailing comma is optional
            if(!c.advanceIfMatch('RIGHT_BRACKET')) throw new Error('Parsing error: Expected closing ] in array');

            return arr;
        }

        // <operator> ::= "==" | "!=" | "<" | ">" | "<=" | "EQ" | "eq" | "lt" | "LT" | <value>
        function operator() : string {
            const operator = c.getCurrentAndAdvance();

            switch (operator.type) {
                case 'GT': return 'gt';
                case 'LT': return 'lt';
                case 'EQ': return 'eq';
                case 'NE': return 'ne';
                case 'GTE': return 'gte';
                case 'LTE': return 'lte';
                case 'IDENTIFIER':
                    if(!c.isValueToken(operator)) throw new Error('Parsing error: Expected value in operator');
                    if(operator.value === null) throw new Error('Parsing error: Expected value for operator, got null');
                    if(typeof operator.value === 'number' ) throw new Error('Parsing error: Invalid value for operator, got number');
                    return operator.value;
                default:
                    throw new Error('Parsing error: Unidentified token in operator');
            }
        }

        const exp = expression();
        if(!c.advanceIfMatch('END')) throw new Error('Parsing error: Expected end of expression');

        return exp;

    }

}