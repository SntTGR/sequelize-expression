import { tokenizer, Token, ValueToken } from '../tokenizer';
import { Op } from 'sequelize';

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
    }
]


describe('tokenizer', () => {
    test.each(operationsToTest.map( o => [o.expression,o.expectedTokens]))('%s', (query, expectedTokenList) => {

        let outputTokens : Token[] = [];

        // Weird typescript transpiling error. VSCode language server thinks query is strictly string, but while running test it spits compiler error saying query is of type string | Token[]
        outputTokens = tokenizer(query as string);
        
        expect(outputTokens).not.toHaveLength(0);
        expect(outputTokens).toStrictEqual(expectedTokenList);

    });
        
    test.todo('Tokenizer error')
})