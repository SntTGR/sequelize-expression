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
        expectedTree : { column : { [Op.eq] : "2" } }
    },
    {
        expression : 'column2 EQ 3',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column2' } as ValueToken, 
            { type: 'EQ' }, 
            { type: 'NUMBER', value: 3} as ValueToken, 
            { type: 'END' }
        ],
        expectedTree : { column2 : { [Op.eq] : 3 } }
    },
    {
        expression : 'column3 IN [1,2,"3",[3.25,"3.50",threePointSevenFive,[],],five]',
        tokenList : [
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
        ],
        expectedTree : { column3 : { [Op.in] : [1,2,'3',[3.25,"3.50",'threePointSevenFive',[]],'five'] } }
    }
]

describe.only('Parser', () => {
    
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