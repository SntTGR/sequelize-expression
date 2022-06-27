import { Parser } from '../parser';

import type { OperationsTree, ParserOps } from '../parser';
import type { NumberToken, StringToken, Token, ValueToken } from '../tokenizer';

import _ from './setup';

import { Op } from 'sequelize';
import type { Primary, PrimaryHook } from '../expression';

const primaryGenerator = (id : number | string) : Token[] => {

    const rV = typeof id === 'string' ? ({ type: 'LITERAL_VALUE', value : id } as StringToken) : ({ type: 'NUMBER', value : id } as NumberToken)

    return [{ type: 'IDENTIFIER', value: `c${id}` } as ValueToken, { type: 'EQ' }, rV]
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
        expression : 'column2 EQ -3',
        tokenList : [
            { type: 'IDENTIFIER', value: 'column2' } as ValueToken, { type: 'EQ' }, { type: 'NUMBER', value: -3} as ValueToken, 
            { type: 'END' }
        ],
        expectedTree : { column2 : { [Op.eq] : -3 } }
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
    },
    {
        expression : '()',
        tokenList : [
            { type: 'LEFT_PAR'},
            { type: 'RIGHT_PAR'},
            { type: 'END' },
        ],
        expectedTree : {}
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
const operationWithVoidsToTest : { expression : string, tokenList : Token[], expectedTree : OperationsTree }[] = [
    {
        expression : 'c1 eq 1 and c2 eq 2 and c3 eq 3 or ( cvoid4 eq "void4" or cvoid5 eq "void5" and cvoid6 eq "void6" )',
        tokenList : [
            ...(primaryGenerator(1)),
            { type: 'AND'},
            ...(primaryGenerator(2)),
            { type: 'AND'},
            ...(primaryGenerator(3)),
            { type: 'OR'},
            { type: 'LEFT_PAR'},
            // ...(primaryGenerator(`void4`)),
            // { type: 'OR'},
            // ...(primaryGenerator(`void5`)),
            // { type: 'AND'},
            // ...(primaryGenerator(`void6`)),
            { type: 'RIGHT_PAR'},
            { type: 'END' }
        ],
        expectedTree : // {
            // [Op.or] : [
                { [Op.and] : 
                    [
                        { c1 : { [Op.eq] : 1 } },
                        { c2 : { [Op.eq] : 2 } },
                        { c3 : { [Op.eq] : 3 } },
                    ] 
                },
                // { 
                    // [Op.or] : 
                    // [
                    //     { c4 : { [Op.eq] : 4 } },
                    //     { [Op.and] : 
                    //         [
                    //             { c5 : { [Op.eq] : 5 } },
                    //             { c6 : { [Op.eq] : 6 } },
                    //         ] 
                    //     }
                    // ]
                // }
    
            // ]
      
        // }
    },
    {
        expression : '! cvoid1 eq 1 AND ( c2 eq 2 AND c3 eq 3 AND c4 eq 4 )',
        tokenList : [
            // { type: 'NOT' }, ...(primaryGenerator('void1')),
            // { type: 'AND' },
            { type: 'LEFT_PAR' },
            ...(primaryGenerator(2)),
            { type: 'AND' },
            ...(primaryGenerator(3)),
            { type: 'AND' },
            ...(primaryGenerator(4)),
            { type: 'RIGHT_PAR' },
            { type: 'END' },
        ],
        expectedTree : { [Op.and] : [
            { c2 : { [Op.eq] : 2 }}, {c3: { [Op.eq] : 3 }}, {c4: { [Op.eq] : 4 }}
        ]}
    },
]

describe('Parser', () => {
    
    let parser : Parser;
    let parserWithPromises : Parser
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
        async (_, tokenList, expectedTree) => {

            const result = await parser.parse(tokenList as Token[])

            expect(result).not.toResultHaveErrors();

            const operationTree = result.getResult();

            expect(operationTree).toBeDefined();
            expect(operationTree).toStrictEqual(expectedTree);

    });

    test.each( operationsErrorsToTest.map( o => [o.expression, o.tokenList, o.expectedErrors] ))('Expecting errors of %s', 
        async (expression, tokenList, expectedErrors) => {

        const parserResult = await parser.parse(tokenList as Token[])

        expect(parserResult).toResultHaveErrors(expectedErrors as string[]);

    })


    describe('With promises', () => {
        
        beforeAll(() => {
            const primaryHook : PrimaryHook = (p) => {
                return new Promise( (res, rej) => {
                    const primary : Primary = {[p.lValue] : {[p.operator] : p.rValue }}
                    setTimeout(
                        () => res(primary),
                        50);
                });
            }

            parserWithPromises = new Parser( 
                { 
                    primary : primaryHook,
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

        test.each( operationsToTest.map( o => [o.expression, o.tokenList, o.expectedTree] ))('With primary promises %s',
            async (_, tokenList, expectedTree) => {
                
                const result = await parserWithPromises.parse(tokenList as Token[]);
                
                expect(result).not.toResultHaveErrors();
                
                const operationTree = result.getResult();

                expect(operationTree).toBeDefined();
                expect(operationTree).toStrictEqual(expectedTree);
            }, 100
        )
    })

    describe('With void promises', () => {

        beforeAll(() => {
            const primaryHook : PrimaryHook = (p) => {
                return new Promise( (res, rej) => {
                    const primary : Primary = {[p.lValue] : {[p.operator] : p.rValue}}
                    
                    if(p.lValue.includes('void')) {
                        setTimeout( () => res(), 50 );
                    } else {
                        setTimeout( () => res(primary), 50 );
                    }

                })
            };

            parserWithPromises = new Parser( 
                { 
                    primary : primaryHook,
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

        test.each( operationWithVoidsToTest.map( o => [o.expression, o.tokenList, o.expectedTree] ))('With void promises %s',
            async (_, tokenList, expectedTree) => {

                const parserResult = await parserWithPromises.parse(tokenList as Token[]);
                expect(parserResult).not.toResultHaveErrors();
                
                const operationTree = parserResult.getResult();

                expect(operationTree).toBeDefined();
                expect(operationTree).toStrictEqual(expectedTree);
                
            }
        )

    })

})