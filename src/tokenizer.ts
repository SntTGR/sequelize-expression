import { ErrorBundle, ExpressionError, ExpressionResult } from "./errors";

export class TokenizerError extends ExpressionError {
    constructor(message : string, position : number, length : number) {
        super(message, position, length);
        Object.setPrototypeOf(this, TokenizerError.prototype);
        this.name = this.constructor.name;
    };
}


export interface Token {
    type : TokenType,
    position? : { start: number, end: number }
}
export interface ValueToken extends Token {
    value : string | number | boolean
}
export interface NumberToken extends ValueToken {
    value : number
}
export interface StringToken extends ValueToken {
    value : string
}
export interface BooleanToken extends ValueToken {
    value : boolean
}

export type TokenType = 
        
    // Value
    'IDENTIFIER'        | // alphanumeric + . + _ + - + % (for compatibility reasons)
    'LITERAL_VALUE'     | // "literal" (with \" as escape)
    'NUMBER'            | // digits + . 
    'BOOLEAN'           | // true false
    'NULL'              | // null

    // Misc
    'LEFT_PAR'          | // (
    'RIGHT_PAR'         | // )
    'LEFT_BRACKET'      | // [
    'RIGHT_BRACKET'     | // ]
    'COMMA'             | // ,
    'SEMICOLON'         | // ;
    
    // Basic operations
    'GT'                | // >
    'LT'                | // <
    'EQ'                | // =
    'NE'                | // !=
    'GTE'               | // >=
    'LTE'               | // <=
    
    // -------------------------------

    // Reserved identifiers

    // Logical
    'NOT'               | // !
    'AND'               | // & or , (comma handled in parser)
    'OR'                | // |

    'END'                 // End of input

const reservedKeywords : {[keyword : string] : Token} = {
    
    // Reserved keywords are case insensitive

    // Logical
    'not'   : { type:'NOT' },
    'and'   : { type:'AND' },
    'or'    : { type:'OR' },
    
    // Basic operations
    'gt'    : { type:'GT' },
    'lt'    : { type:'LT' },
    'eq'    : { type:'EQ' },
    'ne'    : { type:'NE' },
    'gte'   : { type:'GTE' },
    'lte'   : { type:'LTE' },
    
    // null
    'null'  : { type:'NULL' },

    // boolean
    'true'  : { type:'BOOLEAN', value: true } as BooleanToken,
    'false' : { type:'BOOLEAN', value: false } as BooleanToken,

}

class TokenizerContext {

    public source : string;
    public state : {pos : number, tPos : number, length : number};
    public output : Token[] = [];

    private errors : TokenizerError[] = [];

    constructor( input : string ) {
        this.source = input;
        this.state = {
            pos: 0, 
            tPos : 0,
            length : input.length
        } 
    };

    clearTokenPos() {
        this.state.tPos = this.state.pos;
    }

    hadErrors() : boolean {
        return this.errors.length > 0;
    }

    bundleErrors() : ErrorBundle {
        return new ErrorBundle(this.errors, this.source);
    }
    
    newTokenizerHardError(message: string, positionModifier? : number, length? : number) : ErrorBundle {
        this.newTokenizerSoftError(message, positionModifier, length);
        return this.bundleErrors();
    }

    newTokenizerSoftError(message : string, positionModifier : number = 0, length : number = 1) {
        this.errors.push(new TokenizerError(message, this.state.pos + positionModifier, length));
    }

    addTokenInstance( token : Token ) {
        token.position = {
            start : this.state.tPos,
            end: this.state.pos - 1,
        }
        this.clearTokenPos();

        this.output.push(token);
    }
    addToken( type : TokenType ) {
        this.addTokenInstance({type})
    }
    addValueToken( type : TokenType, value : ValueToken['value'] ) {
        this.addTokenInstance({ type, value } as ValueToken);
    }


    isAtEnd() {
        return this.state.pos >= this.state.length
    }

    getCurrentAndAdvance() : string {
        return this.source[this.state.pos++];
    }
    getCurrent() : string {
        return this.source[this.state.pos];
    }
    advanceIfMatch(char : string) : boolean {
        if (this.isAtEnd()) return false;
        
        if(char === this.source[this.state.pos]) {
            this.state.pos++;
            return true;
        }

        return false;
    }
    getNext() : string {
        if(this.isAtEnd()) return '';
        return this.source[this.state.pos];
    }
    isAlphaNumeric(char : string) : boolean {
        return /[0-9a-zA-Z_\-\.%]/.test(char);
    }
    isNumeric(char : string) : boolean {
        return /[0-9\.]/.test(char);
    }


}

export function tokenizer( source : string ) : ExpressionResult<Token[]> {
    
    const c = new TokenizerContext( source );

    // Handlers
    function literalValue() {
        let value = '';

        // first " is ignored
        
        while (c.getCurrent() != '\"' && !c.isAtEnd()) {
            
            // Check if \
            if (c.getCurrent() === '\\') {
                
                const next = c.getNext()

                if(next === '\\' || next === '\"') {
                    c.getCurrentAndAdvance(); // \
                    value += c.getCurrentAndAdvance();
                    continue;
                }

                value += c.getCurrentAndAdvance();
                continue;
            }

            value += c.getCurrentAndAdvance();

        }

        if(c.isAtEnd()) {
            c.newTokenizerSoftError('Expected closing "'); return;
        }

        c.getCurrentAndAdvance(); // last "

        c.addValueToken('LITERAL_VALUE', value);
    }
    function identifier(char : string) {
        
        let value = char;
        while (c.isAlphaNumeric(c.getNext())) value += c.getCurrentAndAdvance();

        // Search for reserved keywords
        const reservedKeywordMatch = reservedKeywords[value.toLowerCase()]        
        if(reservedKeywordMatch) {
            c.addTokenInstance(reservedKeywordMatch);
            return;
        }

        c.addValueToken('IDENTIFIER', value);
        return;
    }
    function number(char : string) {
        let value = char;
        while (c.isNumeric(c.getNext())) value += c.getCurrentAndAdvance();

        const parsedNumber = Number(value);

        if(Number.isNaN(parsedNumber)) { c.newTokenizerSoftError(`Could not parse number: ${value}`, c.state.tPos - c.state.pos, c.state.pos - c.state.tPos); return; }

        c.addValueToken('NUMBER', parsedNumber);
        return;
    }

    
    function scanToken() {
        const char = c.getCurrentAndAdvance();

        switch (char) {
            case ')': c.addToken('RIGHT_PAR'); break;
            case '(': c.addToken('LEFT_PAR'); break;
            case ']': c.addToken('RIGHT_BRACKET'); break;
            case '[': c.addToken('LEFT_BRACKET'); break;
            case ',': c.addToken('COMMA'); break;
            case ';': c.addToken('SEMICOLON'); break;
            case '=': c.addToken('EQ'); break;
            
            case '!': c.advanceIfMatch('=') ? c.addToken('NE') : c.addToken('NOT'); break;
            case '>': c.advanceIfMatch('=') ? c.addToken('GTE') : c.addToken('GT'); break;
            case '<': c.advanceIfMatch('=') ? c.addToken('LTE') : c.addToken('LT'); break;
            
            case '&': c.addToken('AND'); break;
            case '|': c.addToken('OR'); break;
            
            case '\"': literalValue(); break;
            
            case '\t': c.clearTokenPos(); break;
            case ' ': c.clearTokenPos(); break;
            
            default:
                if (c.isNumeric(char)) {number(char); break;}
                if (c.isAlphaNumeric(char)) {identifier(char); break;}
            
                c.newTokenizerSoftError(`Unrecognized character: ${char}`, -1); break;
        }
    }

    while (!c.isAtEnd()) {
        // Main loop
        scanToken();
    }
    
    c.state.pos++;
    c.addToken('END');

    const value = c.hadErrors() ? c.bundleErrors() : c.output;

    return new ExpressionResult<Token[]>(value);
}

