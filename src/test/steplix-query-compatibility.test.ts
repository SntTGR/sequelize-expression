import ExpressionParser from '../expression';
import { Op } from 'sequelize';
import type { PrimaryHook, Primary, PrimaryValues } from '../expression';
const { Parser } = require('steplix-query-filters');

describe.skip('steplix-quey-filters compatibility', () => {

    let steplixParser : typeof Parser;
    let sequelizeExpression : ExpressionParser;
    
    beforeAll(() => {
        steplixParser = new Parser();
        
        sequelizeExpression = new ExpressionParser( Op as any);
        sequelizeExpression.hookPrimary = ( primary : PrimaryValues ) => {
            if (typeof primary.operator.description === 'undefined') throw new Error('Unexpected symbol undefined');

            let opString = primary.operator.description;
            
            // TODO: Check if compatibility error;
            if(primary.operator.description === 'like') opString = 'li';
            if(primary.operator.description === 'notLike') opString = 'nl';
            
            return { [primary.lValue] : { [opString] : primary.rValue === null ? null : primary.rValue.toString() } }
        };
    })

    test.each([
        'column1 eq 2',
        'column2 eq 2,column2 eq 4',
        'column3 li john%',
        'column4 in [1;2;3]',
        'column5 be [1;10]',
        ''
    ])('%s', query => {

        const outputTree = sequelizeExpression.parse(query);
        let steplixOutputTree = steplixParser.parse(query);

        // And syntax
        const expectedTree = Object.keys(steplixOutputTree).length > 1 ? { [Op.and] : Object.entries(steplixOutputTree).map( ([key,value]) => ({ [key] : value }) ) } : steplixOutputTree;
        
        expect(outputTree).toStrictEqual(expectedTree);

    })
})