import expression = require('../expression');
import { Op } from 'sequelize';
const { Parser } = require('steplix-query-filters');

const steplixParser = new Parser();

describe('steplix-quey-filters compatibility', () => {
    
    test.skip.each([
        'column eq 2',
        'column eq 2,column2 eq 4',
        'column li john%'
    ])('%s', query => {

        const tree = steplixParser.parse(query);
        

    })

    
    
})