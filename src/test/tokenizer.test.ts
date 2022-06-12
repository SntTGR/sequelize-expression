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