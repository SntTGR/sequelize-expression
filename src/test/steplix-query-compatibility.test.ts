import ExpressionParser from '../expression';
import { Op } from 'sequelize';
import type { PrimaryHook, Primary, PrimaryValues } from '../expression';
const { Parser } = require('steplix-query-filters');

const steplixOpsPatch = {
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

const steplixOperatorMapper : {[id : string] : string } = {
    eq : 'eq',
    ne : 'ne',
    gt : 'gt',
    gte : 'ge',
    lt : 'lt',
    lte : 'le',
    like : 'li',
    notLike : 'nl',
    in : 'in',
    notIn : 'ni',
    between : 'be',
    notBetween : 'nb',
}

// TODO: feature flag each compatibility features
// TODO: refactor compatibility features once complete set is finished

// TODO: value; mapValue; mapValueFormat; mapValueParse
// TODO: key; mapKey; mapKeyFormat; mapKeyParse
// TODO: operators; operatorPrefix; operatorSuffix; operatorFlags; mapOperator

describe.skip('steplix-quey-filters compatibility', () => {

    let steplixParser : typeof Parser;
    let sequelizeExpression : ExpressionParser;
    
    beforeAll(() => {
        steplixParser = new Parser();
        
        sequelizeExpression = new ExpressionParser(steplixOpsPatch as any);
        sequelizeExpression.hookPrimary = ( primary : PrimaryValues ) => {
            if (typeof primary.operator.description === 'undefined') throw new Error('Unexpected symbol undefined');
            
            let opString = primary.operator.description in steplixOperatorMapper ? steplixOperatorMapper[primary.operator.description] : primary.operator.description;
            
            if(primary.rValue === null) {
                // noop
            } else if(Array.isArray(primary.rValue)) {
                
                if(!primary.rValue.some( v => Array.isArray(v))){
                    primary.rValue = primary.rValue.map(r=>r!==null?r.toString():'null')
                }

            } else if(primary.rValue !== null) {
                primary.rValue = primary.rValue.toString()
            } else {
                throw new Error('Unexpected type in steplix primary hook');
            }
            
            return { [primary.lValue] : { [opString] : primary.rValue} }
        };
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
    ])('%s', query => {

        const outputTree = sequelizeExpression.parse(query).getResult();
        let steplixOutputTree = steplixParser.parse(query);

        // And syntax
        const expectedTree = Object.keys(steplixOutputTree).length > 1 ? { [Op.and] : Object.entries(steplixOutputTree).map( ([key,value]) => ({ [key] : value }) ) } : steplixOutputTree;
        
        expect(outputTree).toStrictEqual(expectedTree);

    })
})