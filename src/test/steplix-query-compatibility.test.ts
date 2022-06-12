import ExpressionParser from '../expression';
import { Op } from 'sequelize';
const { Parser } = require('steplix-query-filters');

describe.only('steplix-quey-filters compatibility', () => {

    let steplixParser : typeof Parser;
    let sequelizeExpression : ExpressionParser;
    
    beforeAll(() => {
        steplixParser = new Parser();
        sequelizeExpression = new ExpressionParser( Op as any );
    })

    test.each([
        'column eq 2',
        'column eq 2,column2 eq 4',
        'column li john%'
    ])('%s', query => {

        const outputTree = sequelizeExpression.parse(query);
        let steplixOutputTree = steplixParser.parse(query);

        // And syntax
        const expectedTree = Object.keys(steplixOutputTree).length > 1 ? { 'Symbol(and)' : Object.entries(steplixOutputTree).map( ([key,value]) => ({ [key] : value }) ) } : steplixOutputTree;
        
        // TODO: Transform number into strings with a hook
        // TODO: Transform operation from symbol into plain string

        expect(outputTree).toStrictEqual(expectedTree);

    })
})