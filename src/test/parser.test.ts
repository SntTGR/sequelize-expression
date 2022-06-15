import { OperationsTree, Parser, ParserOps } from '../parser';
import type { Token, ValueToken } from '../tokenizer';
import { Op } from 'sequelize';

const primaryGenerator = (id : number) : Token[] => {
    return [{ type: 'IDENTIFIER', value: `c${id}` } as ValueToken, { type: 'EQ' }, { type: 'NUMBER', value: id} as ValueToken]
}

const operationsToTest : { expression : string, tokenList : Token[], expectedTree : OperationsTree }[] =
[
    {
        expression : 'column EQ "2"',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column' } as ValueToken, { type: 'EQ' }, { type: 'LITERAL_VALUE', value: '2'} as ValueToken, 
            { type: 'END' }
        ],
        expectedTree : { column : { [Op.eq] : "2" } }
    },
    {
        expression : 'column2 EQ 3',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column2' } as ValueToken, { type: 'EQ' }, { type: 'NUMBER', value: 3} as ValueToken, 
            { type: 'END' }
        ],
        expectedTree : { column2 : { [Op.eq] : 3 } }
    },
    {
        expression : 'c1 eq 1 and c2 eq 2 and c3 eq 3 or ( c4 eq 4 or c5 eq 5 and c6 eq 6 )',
        tokenList : [
            ...(primaryGenerator(1)),
            { type: 'AND'},
            ...(primaryGenerator(2)),
            { type: 'AND'},
            ...(primaryGenerator(3)),
            { type: 'OR'},
            { type: 'LEFT_PAR'},
            ...(primaryGenerator(4)),
            { type: 'OR'},
            ...(primaryGenerator(5)),
            { type: 'AND'},
            ...(primaryGenerator(6)),
            { type: 'RIGHT_PAR'},
            { type: 'END' }
        ],
        expectedTree : {
            [Op.or] : [
                { [Op.and] : 
                    [
                        { c1 : { [Op.eq] : 1 } },
                        { c2 : { [Op.eq] : 2 } },
                        { c3 : { [Op.eq] : 3 } },
                    ] 
                },
                { [Op.or] : 
                    [
                        { c4 : { [Op.eq] : 4 } },
                        { [Op.and] : 
                            [
                                { c5 : { [Op.eq] : 5 } },
                                { c6 : { [Op.eq] : 6 } },
                            ] 
                        }
                    ]
    
                }
    
            ]
      
        }
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
    },
    {
        expression : 'NOT (c1 eq 1)',
        tokenList : [
            { type: 'NOT' }, { type: 'LEFT_PAR'}, ...(primaryGenerator(1)), { type: 'RIGHT_PAR' }, { type: 'END' },
        ],
        expectedTree : { [Op.not] : { c1 : { [Op.eq] : 1 } } }
    },
    {
        expression : 'NOT c1 eq 1 AND ( c2 eq 2 AND c3 eq 3 AND c4 eq 4 )',
        tokenList : [
            { type: 'NOT' }, ...(primaryGenerator(1)),
            { type: 'AND' },
            { type: 'LEFT_PAR' },
            ...(primaryGenerator(2)),
            { type: 'AND' },
            ...(primaryGenerator(3)),
            { type: 'AND' },
            ...(primaryGenerator(4)),
            { type: 'RIGHT_PAR' },
            { type: 'END' },
        ],
        expectedTree : { [Op.and] : [{[Op.not] : { c1 : { [Op.eq] : 1 } }}, { [Op.and] : [{ c2 : { [Op.eq] : 2 }}, {c3: { [Op.eq] : 3 }}, {c4: { [Op.eq] : 4 }}] }] }
    },
    {
        expression : 'NOT c1 eq 1 AND NOT ( c2 eq 2 AND c3 eq 3 AND c4 eq 4 )',
        tokenList : [
            { type: 'NOT' }, ...(primaryGenerator(1)),
            { type: 'AND' },
            { type: 'NOT' }, { type: 'LEFT_PAR' },
            ...(primaryGenerator(2)),
            { type: 'AND' },
            ...(primaryGenerator(3)),
            { type: 'AND' },
            ...(primaryGenerator(4)),
            { type: 'RIGHT_PAR' },
            { type: 'END' },
        ],
        expectedTree : { [Op.and] : [{[Op.not] : { c1 : { [Op.eq] : 1 } }}, { [Op.not] : { [Op.and] : [{ c2 : { [Op.eq] : 2 }}, {c3: { [Op.eq] : 3 }}, {c4: { [Op.eq] : 4 }}] }}] }
    },
    {
        expression : 'NOT c1 eq 1 OR NOT ( c2 eq 2 OR c3 eq 3 OR c4 eq 4 )',
        tokenList : [
            { type: 'NOT' }, ...(primaryGenerator(1)),
            { type: 'OR' },
            { type: 'NOT' }, { type: 'LEFT_PAR' },
            ...(primaryGenerator(2)),
            { type: 'OR' },
            ...(primaryGenerator(3)),
            { type: 'OR' },
            ...(primaryGenerator(4)),
            { type: 'RIGHT_PAR' },
            { type: 'END' },
        ],
        expectedTree : { [Op.or] : [{[Op.not] : { c1 : { [Op.eq] : 1 } }}, { [Op.not] : { [Op.or] : [{ c2 : { [Op.eq] : 2 }}, {c3: { [Op.eq] : 3 }}, {c4: { [Op.eq] : 4 }}] }}] }
    },
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