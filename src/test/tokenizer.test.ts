import { tokenizer, Token, ValueToken, StringToken, NumberToken, TokenizerError, BooleanToken } from '../tokenizer';

import _ from './setup';

const operationsToTest : { expression : string, expectedTokens : Token[] }[] =
[
    {
        expression : 'column EQ 2',
        expectedTokens : [
            { type: 'IDENTIFIER', value: 'column' } as ValueToken, 
            { type: 'EQ' }, 
            { type: 'NUMBER', value: 2} as ValueToken, 
            { type: 'END' }
        ]
    },
    {
        expression : 'column2 EQ "3"',
        expectedTokens : [
            { type: 'IDENTIFIER', value: 'column2' } as ValueToken, 
            { type: 'EQ' }, 
            { type: 'LITERAL_VALUE', value: '3'} as ValueToken, 
            { type: 'END' }
        ]
    },
    {
        expression : 'column3 IN [1,2,"3",[3.25,"3.50",threePointSevenFive,[],],five]',
        expectedTokens : [
            { type: 'IDENTIFIER', value: 'column3' } as ValueToken, 
            { type: 'IDENTIFIER', value: 'IN' } as ValueToken,
            { type: 'LEFT_BRACKET' },
            { type: 'NUMBER', value: 1 } as ValueToken,
            { type: 'COMMA'}, 
            { type: 'NUMBER', value: 2 } as ValueToken,
            { type: 'COMMA'},
            { type: 'LITERAL_VALUE', value: '3' } as ValueToken,
            { type: 'COMMA'},
            { type: 'LEFT_BRACKET' },
            { type: 'NUMBER', value: 3.25 } as ValueToken,
            { type: 'COMMA'},
            { type: 'LITERAL_VALUE', value: '3.50' } as ValueToken,
            { type: 'COMMA'},
            { type: 'IDENTIFIER', value: 'threePointSevenFive' } as ValueToken,
            { type: 'COMMA'},
            { type: 'LEFT_BRACKET' },
            { type: 'RIGHT_BRACKET' },
            { type: 'COMMA'},
            { type: 'RIGHT_BRACKET' },
            { type: 'COMMA'},
            { type: 'IDENTIFIER', value: 'five' } as ValueToken,
            { type: 'RIGHT_BRACKET' },
            { type: 'END' }
        ]
    },
    {
        expression : 'column4 in [1;false;3]',
        expectedTokens : [
            { type: 'IDENTIFIER', value: 'column4' } as StringToken,
            { type: 'IDENTIFIER', value: 'in' } as StringToken,
            { type: 'LEFT_BRACKET' },
            { type: 'NUMBER', value: 1 } as NumberToken,
            { type: 'SEMICOLON' },
            { type: 'BOOLEAN', value: false } as BooleanToken,
            { type: 'SEMICOLON' },
            { type: 'NUMBER', value: 3 } as NumberToken,
            { type: 'RIGHT_BRACKET' },
            { type: 'END' },
        ],
    }
]
const operationsPositionToTest : { expression : string, expectedTokens: Token[] }[] = [
    {
        expression : 'column EQ 2',
        expectedTokens : [
            { type: 'IDENTIFIER', value: 'column',      position: { start: 0, end: 5 } } as ValueToken, 
            { type: 'EQ',                               position: { start: 7, end: 8 } }, 
            { type: 'NUMBER', value: 2,                 position: { start: 10, end: 10 } } as ValueToken, 
            { type: 'END',                              position: { start: 11, end: 11 } }
        ]
    },
    {
        expression : '   column2            EQ     "3"  ',
        expectedTokens : [
            { type: 'IDENTIFIER', value: 'column2',     position: { start: 3,  end: 9  } } as ValueToken, 
            { type: 'EQ',                               position: { start: 22, end: 23 } }, 
            { type: 'LITERAL_VALUE', value: '3',        position: { start: 29, end: 31 } } as ValueToken, 
            { type: 'END',                              position: { start: 34, end: 34 } }
        ]
    },
]
const operationsErrorsToTest : { expression : string, expectedErrors : string[] }[] = [
    {
        expression : 'column eq \"jorge',
        expectedErrors : [
            'Expected closing "'
        ]
    },
    {
        expression : 'column eq #¿asd',
        expectedErrors : [
            'Unrecognized character: #',
            'Unrecognized character: ¿'
        ]
    },
    {
        expression : 'column eq 1.52.68',
        expectedErrors : [
            'Could not parse number: 1.52.68'
        ]
    },
]

function scrubPositionsFromTokenList( tL : Token[] ) {
    for (const token of tL) {
        delete token.position;
    }
}


describe('tokenizer', () => {
    test.each(operationsToTest.map( o => [o.expression,o.expectedTokens]))('Tokens of %s', (query, expectedTokenList) => {

        let outputTokens : Token[] = [];

        const result = tokenizer(query as string);
        expect(result).not.toResultHaveErrors();

        // Weird typescript error. VSCode language server thinks query is strictly string, but while running test it spits compiler error saying query is of type string | Token[]
        outputTokens = result.getResult();

        scrubPositionsFromTokenList(outputTokens);

        expect(outputTokens).not.toHaveLength(0);
        expect(outputTokens).toStrictEqual(expectedTokenList);

    });

    test.each(operationsPositionToTest.map( o => [o.expression,o.expectedTokens]))('Token positions of %s', (query, expectedTokenList) => {

        let outputTokens : Token[] = [];

        const result = tokenizer(query as string);
        expect(result).not.toResultHaveErrors();

        outputTokens = result.getResult();
        
        expect(outputTokens).not.toHaveLength(0);
        expect(outputTokens).toStrictEqual(expectedTokenList);

    });

    test.each(operationsErrorsToTest.map( o => [o.expression,o.expectedErrors]))('Token errors of %s', (query, expectedErrors) => {

        const result = tokenizer(query as string);
      
        expect(result).toResultHaveErrors(expectedErrors as string[]);

    })

})