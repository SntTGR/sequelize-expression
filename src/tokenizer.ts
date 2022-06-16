// TODO: Tokenizer Error

export type TokenType = 
        
    // Value
    'IDENTIFIER'        | // alphanumeric + . + _ + - + % (for compatibility reasons)
    'LITERAL_VALUE'     | // "literal" (with \" as escape)
    'NUMBER'            | // digits + . 
    'NULL'              | // null

    // Misc
    'LEFT_PAR'          | // (
    'RIGHT_PAR'         | // )
    'LEFT_BRACKET'      | // [
    'RIGHT_BRACKET'     | // ]
    'COMMA'             | // ,
    'SEMICOLON'         | // ;
    
    // TODO: support semicolon for steplix arrays

    // Basic operations
    'GT'                | // > or gt
    'LT'                | // < or lt
    'EQ'                | // = or eq
    'NE'                | // != or ne
    'GTE'               | // >= or gte
    'LTE'               | // <= or lte
    
    // -------------------------------

    // Reserved identifiers

    // Logical
    'NOT'               | // ! or NOT
    'AND'               | // & or AND (also accepts comma but handled in parser)
    'OR'                | // | or OR

    'END'                 // End of input

                          // NOTE: maybe add more, make it retrocompatible with steplix filter


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

    // Steplix Compatibility
    // TODO: Make the compatibility in hook or in the Op mapper
    // 'li'    : { type:'IDENTIFIER', value: 'like'} as ValueToken,
    // 'nl'    : { type:'IDENTIFIER', value: 'notLike'} as ValueToken,         // --------------------------
    // 'in'    : { type:'IDENTIFIER', value: 'in'} as ValueToken,              // in.             ~~ in parser: Expect array value ~~ concern of sequelize interpreter
    // 'ni'    : { type:'IDENTIFIER', value: 'notIn'} as ValueToken,           // notIn.          ~~ in parser: Expect array value ~~ concern of sequelize interpreter
    // 'be'    : { type:'IDENTIFIER', value: 'between'} as ValueToken,         // between.        ~~ in parser: Expect array length 2 value ~~ concern of sequelize interpreter
    // 'nb'    : { type:'IDENTIFIER', value: 'notBetween'} as ValueToken,      // notBetween.     ~~ in parser: Expect array length 2 value ~~ concern of sequelize interpreter

}


export interface Token {
    type : TokenType
}
export interface NumberToken extends ValueToken {
    value : number
}
export interface StringToken extends ValueToken {
    value : string
}

export interface ValueToken extends Token {
    value : string | number
}

// TODO: automatic error handling
    // TODO: Had error flag that doesn't execute
    // TODO: error should be list of error

class TokenizerContext {

    public source : string;
    public state : {pos : number, tPos : number, length : number};
    public output : Token[] = [];

    constructor( input : string ) {
        this.source = input;
        this.state = {
            pos: 0,
            tPos : 0,
            length : input.length
        }
    };

    addTokenInstance( token : Token ) {
        this.output.push(token);
    }
    addToken( type : TokenType ) {
        this.output.push( { type } )
    }
    addValueToken( type : TokenType, value : ValueToken['value'] ) {
        this.output.push({ type, value } as ValueToken)
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

export function tokenizer( source : string ) : Token[] {
    
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
            // TODO: error, expected closing "
            throw new Error('Parsing error: expected closing "');
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

        // TODO: proper error handling
        if(Number.isNaN(parsedNumber)) throw new Error('Parsing error: could not parse number');

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
            
            case '\t': break;
            case ' ': break;
            
            default:
                if (c.isNumeric(char)) {number(char); break;}
                if (c.isAlphaNumeric(char)) {identifier(char); break;}
            
                // TODO: Proper error handling: Unexpected char
                throw new Error('parser error: unexpected char');
                break;
        }
    }

    while (!c.isAtEnd()) {
        // Main loop
        scanToken();
    }
    c.addToken('END');

    return c.output;
}

