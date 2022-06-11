// TODO: Tokenizer Error

export type TokenType = 
        
    // Value
    'IDENTIFIER'        | // alphanumeric + . + _ + -
    'LITERAL_VALUE'     | // "literal" (with \" as escape)

    // Misc
    'LEFT_PAR'          | // (
    'RIGHT_PAR'         | // )
    'LEFT_BRACKET'      | // [
    'RIGHT_BRACKET'     | // ]
    'COMMA'             | // ,
    // Operations
    'GT'                | // > or gt
    'LT'                | // < or gt
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
    'not'   : { type:'NOT' },
    'and'   : { type:'AND' },
    'or'    : { type:'OR' },
    'gt'    : { type:'GT' },
    'lt'    : { type:'LT' },
    'eq'    : { type:'EQ' },
    'ne'    : { type:'NE' },
    'gte'   : { type:'GTE' },
    'lte'   : { type:'LTE' },
    'null'  : { type:'IDENTIFIER', value: null } as ValueToken,
}


export interface Token {
    type : TokenType
}

export interface ValueToken extends Token {
    value : string | null
}


// TODO: PARSER HOOKs default!
// TODO: automatic error handling
    // TODO: Had error flag that doesn't execute
    // TODO: error should be list of error

export function tokenizer( source : string ) : Token[] {
    
    const tokens : Token[] = [];
    
    const state : {pos : number, tPos : number, length : number,  } = {
        pos : 0,
        tPos : 0,
        length : source.length,
    }

    // Handlers
    function literalValue() {
        let value = '';

        getCurrentAndAdvance(); // ignore first "
        
        while (getCurrent() != '\"' && !isAtEnd()) {
            
            // Check if \
            if (getCurrent() === '\\') {
                
                const next = getNext()

                if(next === '\\' || next === '\"') {
                    getCurrentAndAdvance(); // \
                    value += getCurrentAndAdvance();
                    continue;
                }

                value += getCurrentAndAdvance();
                continue;
            }

            value += getCurrentAndAdvance();

        }

        if(isAtEnd()) {
            // TODO: error, expected closing "
            throw new Error('Parsing error: expected closing "');
        }

        getCurrentAndAdvance(); // last "

        addValueToken('LITERAL_VALUE', value);
    }
    function identifier(char : string) {
        
        let value = char;
        while (isAlphaNumeric(getNext())) value += getCurrentAndAdvance();

        // Search for reserved keywords
        const reservedKeywordMatch = reservedKeywords[value.toLowerCase()]        
        if(reservedKeywordMatch) {
            addTokenInstance(reservedKeywordMatch);
            return;
        }

        addValueToken('IDENTIFIER', value);
        return;
        
    }
    

    // Helpers
    function addTokenInstance( token : Token ) {
        tokens.push(token);
    }
    function addToken( type : TokenType ) {
        tokens.push( { type } )
    }
    function addValueToken( type : TokenType, value : string ) {
        tokens.push({ type, value } as ValueToken)
    }


    function isAtEnd() {
        return state.pos >= state.length
    }

    function getCurrentAndAdvance() : string {
        return source[state.pos++];
    }
    function getCurrent() : string {
        return source[state.pos];
    }
    function advanceIfMatch(char : string) : boolean {
        if (isAtEnd()) return false;
        
        if(char === source[state.pos]) {
            state.pos++;
            return true;
        }

        return false;
    }
    function getNext() : string {
        if(isAtEnd()) return '';
        return source[state.pos];
    }
    function isAlphaNumeric(char : string) : boolean {
        return /[0-9a-zA-Z_\-\.]/.test(char);
    }


    function scanToken() {
        const c = getCurrentAndAdvance();

        switch (c) {
            case ')': addToken('RIGHT_PAR'); break;
            case '(': addToken('LEFT_PAR'); break;
            case '[': addToken('RIGHT_BRACKET'); break;
            case ']': addToken('LEFT_BRACKET'); break;
            case ',': addToken('COMMA'); break;
            case '=': addToken('EQ'); break;
            
            case '!': advanceIfMatch('=') ? addToken('NE') : addToken('NOT'); break;
            case '>': advanceIfMatch('=') ? addToken('GTE') : addToken('GT'); break;
            case '<': advanceIfMatch('=') ? addToken('LTE') : addToken('LT'); break;
            
            case '&': addToken('AND'); break;
            case '|': addToken('OR'); break;
            
            case '\"': literalValue(); break;
            
            case '\t': break;
            case ' ': break;
            
            default:
                if (isAlphaNumeric(c)) {identifier(c); break;}
            
                // TODO: Proper error handling: Unexpected char
                throw new Error('parser error: unexpected char');
                break;
        }
    }

    while (!isAtEnd()) {
        // Main loop
        scanToken();
    }
    addToken('END');

    return tokens;
}

