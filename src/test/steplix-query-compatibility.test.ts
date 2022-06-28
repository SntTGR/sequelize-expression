import ExpressionParser from '../expression';
import { Op } from 'sequelize';

import _ from './setup';

import type { PrimaryResolver, OperatorResolver } from '../expression';
import type { RightValue, OperationsTree } from '../parser';

const { Parser } = require('steplix-query-filters');

const steplixOpsPatch : { [s : string] : symbol } = {
    ...Op,
    eq : Op.eq,
    ne : Op.ne,
    gt : Op.gt,
    ge : Op.gte,
    lt : Op.lt,
    le : Op.lte,
    li : Op.like,
    nl : Op.notLike,
    in : Op.in,
    ni : Op.notIn,
    be : Op.between,
    nb : Op.notBetween,
}

describe('steplix-quey-filters compatibility', () => {

    let steplixParser : typeof Parser;
    let sequelizeExpression : ExpressionParser;
    let compatibilityOutput : (o : OperationsTree) => OperationsTree;

    
    beforeAll(() => {
        
        steplixParser = new Parser();

        const compatibilityOperator : OperatorResolver = (op, err) => {
            const sOp = steplixOpsPatch[op]
            if(!sOp) {err(`Could not resolve operator ${op}`); return Symbol('noop')}
            if(op === 'and' || op === 'or' || op === 'not') return sOp;
            return Symbol(op);
        }
        const compatibilityPrimary : PrimaryResolver = (p, err) => {
            const arrTransform = (itself : any, obj : RightValue) => { 
                if(Array.isArray(obj)) return obj.map( (i) => itself(itself, i) ) 
                return obj !== null ? obj.toString() : obj;
            }
            const parsedRValue = arrTransform(arrTransform, p.rValue);

            return { [p.lValue] : { [p.operator.description as string] : parsedRValue } }
        }
        compatibilityOutput = (o) => {
            // And Syntax
            // TODO: Refactor me
            const andSymbol = Object.getOwnPropertySymbols(o).find( k => k.description === 'and' )
            let parsedTree : any = {};
            if(andSymbol) {
                const copyOfO = {...o};
                const values = (copyOfO as any)[andSymbol as any] as OperationsTree | OperationsTree[]
                if(Array.isArray(values)) {
                    values.forEach( (obj) => {
                        const id = Reflect.ownKeys(obj)[0];
                        parsedTree[id] = (obj as any)[id as any];
                    })
                } else {
                    const id = Reflect.ownKeys(values)[0];
                    parsedTree[id] = (values)[id as any];
                }
    
                delete (copyOfO as any)[andSymbol as any]; 
                return {...copyOfO, ...parsedTree};
            }
            return o;
        };
        

        sequelizeExpression = new ExpressionParser({resolvers:{primary:compatibilityPrimary,operator:compatibilityOperator}});

    })

    test.each([
        
        'id eq 1',
        'name ne nico',
        'id gt 1',
        'id ge 10',
        'id lt 1',
        'name li nico%',
        'name nl nico%',
        'id in [1;2;3]',
        'id ni [1;2;3]',
        'id be [1;10]',
        'id nb [1;10]',
        'column4 in [1;2;3]',
        'column5 be [1;10]',
        'column6 nl _j_%',
        'ColUmn7 nb [1;2]',

        'id eq 1,id2 eq 2',
        'id eq 1,id2 in [1;2;3]'

    ])('Compatibility of %s', async query => {

        const result = await sequelizeExpression.parse(query);
        expect(result).not.toResultHaveErrors();
        const outputTree = result.getResult();
        let steplixOutputTree = steplixParser.parse(query);

        const compatibleOutput =  compatibilityOutput(outputTree);
        
        expect(compatibleOutput).toStrictEqual(steplixOutputTree);

    })

    test.each([
        
        ['id eq 1 AND id2 eq 2',                            { id :       { eq : '1' }, id2 : { eq : '2' } }],
        ['name ne nico OR name2 eq nip',                    { [Op.or] : [{ name : { ne : 'nico' } }, { name2 : { eq : 'nip' } }] } ],
        ['id in [1,2,[9,[2]]]',                             { id :       { in : ['1','2',['9',['2']]] } }],
        ['name nl nico% AND (id eq 1 OR id2 eq 2)',         { name :     { nl : 'nico%' }, [Op.or] : [{ id : { eq : '1' } }, { id2 : { eq : '2' }}] }],
        ['name nl nico% AND (id eq 1 AND id2 eq 2)',        { name :     { nl : 'nico%' }, [Op.and] : [{ id : { eq : '1' } }, { id2 : { eq : '2' }}] }],
        ['name nl nico% AND !(id eq 1 AND id2 eq 2)',       { name :     { nl : 'nico%' }, [Op.not] : {[Op.and] : [{ id : { eq : '1' } }, { id2 : { eq : '2' }}]}}],

    ])('Functionality of %s', async (query, tree) => {

        const result = await sequelizeExpression.parse(query);
        expect(result).not.toResultHaveErrors();
        const outputTree = result.getResult();
        const compatibleOutput =  compatibilityOutput(outputTree);
        
        expect(compatibleOutput).toStrictEqual(tree);

    })

})