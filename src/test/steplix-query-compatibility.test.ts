import Expression = require('../expression');
import { Op } from 'sequelize';
const { Parser } = require('steplix-query-filters');



describe.skip('steplix-quey-filters compatibility', () => {

    let steplixParser : typeof Parser;
    
    beforeAll(() => {
        steplixParser = new Parser();
    })

    test.each([
        'column eq 2',
        'column eq 2,column2 eq 4',
        'column li john%'
    ])('%s', query => {

        const tree = steplixParser.parse(query);
        

    })
})