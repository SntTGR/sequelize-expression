import { Parser, ParserError } from '../parser';

import type { OperationsTree, ParserOps } from '../parser';
import type { NumberToken, StringToken, Token, ValueToken } from '../tokenizer';

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
    {
        expression : 'column4 iN [1;2;3]',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column4' } as StringToken,
            { type: 'IDENTIFIER', value: 'iN' } as StringToken,
            { type: 'LEFT_BRACKET' },
            { type: 'NUMBER', value: 1 } as NumberToken,
            { type: 'SEMICOLON' },
            { type: 'NUMBER', value: 2 } as NumberToken,
            { type: 'SEMICOLON' },
            { type: 'NUMBER', value: 3 } as NumberToken,
            { type: 'RIGHT_BRACKET' },
            { type: 'END' }
        ],
        expectedTree : { column4 : { [Op.in] : [1,2,3] } }
    },
    {
        expression : 'c1 notilikE %hat',
        tokenList : [
            { type: 'IDENTIFIER', value: 'c1' } as StringToken,
            { type: 'IDENTIFIER', value: 'notilikE' } as StringToken,
            { type: 'IDENTIFIER', value: '%hat' } as StringToken,
            { type: 'END' }
        ],
        expectedTree : { c1 : { [Op.notILike] : '%hat' } }
    }
]
const operationsErrorsToTest : { expression : string, tokenList : Token[], expectedErrors : string[] }[] = [
    {
        expression: 'col1 eq [1,2',
        tokenList: [
            { type: 'IDENTIFIER', value: 'col1' } as ValueToken, { type: 'EQ' }, 
                { type: 'LEFT_BRACKET'}, { type: 'NUMBER', value: 1} as ValueToken, { type: 'COMMA'}, { type: 'NUMBER', value: 2},
            { type: 'END', position: { start: 12, end: 12 } }
        ],
        expectedErrors: ['Expected closing ]']
    },
    {
        expression: 'null eq 1',
        tokenList: [
            { type: 'NULL', position: { start: 0, end: 3 } }, { type: 'EQ'}, { type: 'NUMBER', value: 1 } as ValueToken,
            { type: 'END' }
        ],
        expectedErrors: ['Expected an identifier']
    },
    {
        expression: 'col1 3 1',
        tokenList: [
            { type: 'IDENTIFIER', value: 'col1' }, { type: 'NUMBER', value: 3, position: { start: 5, end: 5 } }, { type: 'NUMBER', value: 1 } as ValueToken,
            { type: 'END' }
        ],
        expectedErrors: ['Unexpected token type of NUMBER in operator']
    },
    {
        expression: 'col1 peep 1',
        tokenList: [
            { type: 'IDENTIFIER', value: 'col1' } as ValueToken, { type: 'IDENTIFIER', value: 'peep', position: { start: 5, end : 8 }} as ValueToken, { type: 'NUMBER', value: 1 } as ValueToken,
            { type: 'END' }
        ],
        expectedErrors: ['Could not resolve operator: peep']
    },
    {
        expression: '(col1 eq 1',
        tokenList: [
            { type: 'LEFT_PAR' },
            { type: 'IDENTIFIER', value: 'col1' } as ValueToken, { type: 'EQ' }, { type: 'NUMBER', value: 1 } as ValueToken,
            { type: 'END', position: { start: 10, end: 10 } }
        ],
        expectedErrors: ['Expected closing ) value']
    },
    {
        expression: '((col1 eq 1',
        tokenList: [
            { type: 'LEFT_PAR' },
            { type: 'LEFT_PAR' },
            { type: 'IDENTIFIER', value: 'col1' } as ValueToken, { type: 'EQ' }, { type: 'NUMBER', value: 1 } as ValueToken,
            { type: 'END', position: { start: 11, end: 11 } }
        ],
        expectedErrors: ['Expected closing ) value', 'Expected closing ) value']
    },
    {
        expression: 'col1 eq [1,2,,]',
        tokenList: [
            { type: 'IDENTIFIER', value: 'col1' } as ValueToken, { type: 'EQ' }, 
                { type: 'LEFT_BRACKET'}, 
                    { type: 'NUMBER', value: 1} as ValueToken, { type: 'COMMA'}, { type: 'NUMBER', value: 2}, { type: 'COMMA'}, { type: 'COMMA', position: { start: 13, end: 13 }},
                { type: 'RIGHT_BRACKET'}, 
            { type: 'END' }
        ],
        expectedErrors: ['Expected an identifier']
    },
]

describe('Parser', () => {
    
    let parser : Parser;
    const lowerCaseOps : ParserOps = {};

    beforeAll( () => {

        Object.entries(Op).forEach( ([key, value]) => lowerCaseOps[key.toLowerCase()] = value );

        parser = new Parser( 
            { 
                primary : (p) => ({[p.lValue] : {[p.operator] : p.rValue }}), 
                operator : (op, err) => {
                    const opSymbol = (lowerCaseOps)[op.toLowerCase()]; 
                    if(typeof opSymbol === 'undefined'){ 
                        err(`Could not resolve operator: ${op}`);
                        return Symbol('noop')
                    } else {
                        return opSymbol
                    }
                } 
            }
        );
    })

    test.each( operationsToTest.map( o => [o.expression, o.tokenList, o.expectedTree] ))('%s', 
        (_, tokenList, expectedTree) => {

        const operationTree = parser.parse(tokenList as Token[]).getResult();

        expect(operationTree).toBeDefined();
        expect(operationTree).toStrictEqual(expectedTree);

    });

    test.each( operationsErrorsToTest.map( o => [o.expression, o.tokenList, o.expectedErrors] ))('Expecting errors of %s', 
        (expression, tokenList, expectedErrors) => {

        const parserResult = parser.parse(tokenList as Token[])

        expect(parserResult.ok).toBe(false);
        const sortedErrors = parserResult.getErrors().errors.map(e=>e.message).sort();
    
        expect(sortedErrors).toEqual((expectedErrors as string[]).sort());
        parserResult.getErrors().setInput(expression as string);
        parserResult.getErrors().toString();

        expect(parserResult.getErrors().errors.every(e=>e instanceof ParserError)).toBe(true);

    })
})