import type { Token, TokenType, ValueToken } from './tokenizer';
import { Op } from 'sequelize';


interface OperationsTree {
    [operation : string] : OperationsTree | RightValue
}
type LeftValue = string;
type RightValue = string | null | RightValue[];


export function parser( tokenList : Token[] ) {

    const tokens = [...tokenList]

    const state : {pos : number, tPos : number, length : number,  } = {
        pos : 0,
        tPos : 0,
        length : tokens.length,
    }


    function isAtEnd() : boolean {
        return state.pos >= state.length;
    }
    
    function isCurrentMatch(type : TokenType) : boolean {
        if(isAtEnd()) return false;
        
        return getCurrentTokenType() === type;
    }
    
    function getCurrentToken() : Token {
        if (!isAtEnd()) {
            return tokens[state.pos];
        }
        // TODO: proper error handling
        throw new Error('Parsing error: Invalid token state');
    }
    
    function getCurrentTokenType() : TokenType {
        return getCurrentToken().type;
    }
    
    function advanceIfMatch( ...types : TokenType[] ) : boolean {
        for (const type of types) {
            if (isCurrentMatch(type)) {
                getCurrentAndAdvance();
                return true;
            }
        }
        return false
    }

    function getCurrentAndAdvance() : Token {
        return tokens[state.pos++];
    }

    // TODO: Read up on type guards
    function isValueToken(token : Token) : token is ValueToken {
        return 'value' in token;
    }


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

    // <expression> ::= <andBinary>
    function expression() : OperationsTree {
        return andBinary();
    }

    // <andBinary> ::= <orBinary> ( <and> <orBinary> )*
    function andBinary() : OperationsTree {
        const lOrBinary = orBinary();
        const andGenerator = { [Op.and] : [lOrBinary] };
        while(advanceIfMatch( 'AND', 'COMMA' )) {
            andGenerator[Op.and].push(orBinary());
        }
        return andGenerator[Op.and].length === 1 ? lOrBinary : andGenerator;
    }

    // <orBinary> ::= <unary> ( <or> <unary> )*
    function orBinary() : OperationsTree {
        const lUnary = unary();
        const orGenerator = { [Op.or] : [lUnary] };
        while (advanceIfMatch('OR')) {
            orGenerator[Op.or].push(unary());
        }
        return orGenerator[Op.or].length === 1 ? lUnary : orGenerator;
    }

    // <unary> ::= <not> <unary> | <primary>
    function unary() : OperationsTree {
        if (advanceIfMatch('NOT')) {
            return { [Op.not] : unary() };
        }
        return primary();
    }

    // <primary> ::= <leftValue> <operator> <rightValue> | "(" <expression> ")"
    function primary() : OperationsTree {
        
        if(advanceIfMatch('LEFT_PAR')) {
            const exp = expression();
            if(!advanceIfMatch('RIGHT_PAR')) throw new Error('Parsing error: Expected closing ) value');
            return exp;
        }

        // Left value
        const lValue = leftValue();
        const op = operator();
        const rValue = rightValue();

        return { [lValue] : { [`Symbol(${op})`] : rValue } };
    }

    // TODO: update this definition as it doesn't accept null
    // <leftValue> ::= <value> | <literalValue>
    function leftValue() : string {
        if(isCurrentMatch('LITERAL_VALUE')) {            
            const leftToken = getCurrentAndAdvance();
            
            // TODO: proper error handling
            if(!isValueToken(leftToken)) throw new Error('Parsing error: Expected value in leftValue');
            if(leftToken.value === null) throw new Error('Parsing error: Expected value in leftValue, got null'); // This error would never happen
            
            return leftToken.value;
        }

        const v = value();
        if(v === null) throw new Error('Parsing error: Expected value in leftValue, got null');

        return v;
    }
    
    function value() : string | null {
        const valueToken = getCurrentAndAdvance()
        // TODO: proper error handling
        if(valueToken.type !== 'IDENTIFIER') throw new Error('Parsing error: Expected identifier in value');
        if(!isValueToken(valueToken)) throw new Error('Parsing error: Expected value in value');
        return valueToken.value;
    }

    // <rightValue> ::= <value> | <array> | <literalValue>
    function rightValue() : RightValue {
        
        if(advanceIfMatch('LEFT_BRACKET')) {
            const rValue = array();
            // TODO: proper error handling
            if(!advanceIfMatch('RIGHT_BRACKET')) throw new Error('Parsing error: Expected closing ] in rightValue');
            return rValue;
        }
        
        if(isCurrentMatch('LITERAL_VALUE')) {
            const rValue = getCurrentAndAdvance();
            // TODO: proper error handling
            if(!isValueToken(rValue)) throw new Error('Parsing error: Expected value in rightValue');
            return rValue.value;
        }

        return value();
    }

    // <array> ::= "[" ( (<rightValue>) ("," (<rightValue>))* (",")? )? "]"
    function array() : RightValue[] {
        const arr : RightValue[] = [];

        // [ already consumed
        while(!isCurrentMatch('RIGHT_BRACKET') && !isAtEnd){
            arr.push( rightValue() );
            
            if(advanceIfMatch('COMMA')) continue;
            break;
        }

        advanceIfMatch('COMMA') // trailing comma is optional
        if(!advanceIfMatch('RIGHT_BRACKET')) throw new Error('Parsing error: Expected closing ] in array');

        return arr;
    }

    // <operator> ::= "==" | "!=" | "<" | ">" | "<=" | "EQ" | "eq" | "lt" | "LT" | <value>
    function operator() : string {
        const operator = getCurrentAndAdvance();

        switch (operator.type) {
            case 'GT': return 'gt';
            case 'LT': return 'lt';
            case 'EQ': return 'eq';
            case 'NE': return 'ne';
            case 'GTE': return 'gte';
            case 'LTE': return 'lte';
            case 'IDENTIFIER':
                if(!isValueToken(operator)) throw new Error('Parsing error: Expected value in operator');
                if(operator.value === null) throw new Error('Parsing error: Expected value for operator, got null');

                return operator.value;
            default:
                throw new Error('Parsing error: Unidentified token in operator');
        }
    }

    const exp = expression();
    if(!advanceIfMatch('END')) throw new Error('Parsing error: Expected end of expression');

    return exp;

}