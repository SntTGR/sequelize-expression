import { OperationsTree, Parser, ParserOps } from '../parser';
import type { Token, ValueToken } from '../tokenizer';
import { Op } from 'sequelize';

const operationsToTest : { expression : string, tokenList : Token[], expectedTree : OperationsTree }[] =
[
    {
        expression : 'column EQ "2"',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column' } as ValueToken, 
            { type: 'EQ' }, 
            { type: 'LITERAL_VALUE', value: '2'} as ValueToken, 
            { type: 'END' }
        ],
        expectedTree : { column : { [Op.eq.toString()] : "2" } }
    },
    {
        expression : 'column2 EQ 3',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column2' } as ValueToken, 
            { type: 'EQ' }, 
            { type: 'NUMBER', value: 3} as ValueToken, 
            { type: 'END' }
        ],
        expectedTree : { column2 : { [Op.eq.toString()] : 3 } }
    }
]

describe('Parser', () => {
    
    let parser : Parser;

    beforeAll( () => {
        parser = new Parser(Op as any);
    })

    test.each( operationsToTest.map( o => [o.expression, o.tokenList, o.expectedTree] ))('%s', (_, tokenList, expectedTree) => {

        const operationTree = parser.parse(tokenList as Token[]);

        expect(operationTree).toBeDefined();
        expect(operationTree).toStrictEqual(expectedTree);

    });

    test.todo('Parser panic');
    test.todo('Parser error');
})