import Expression from '../expression'
import { Op } from 'sequelize';

describe.skip('sequelize-expression.js', () => {

    test('plain initialization', () => {
        const expression = new Expression({});
    });

    test.todo('initialization with sequelize operations');
    test.todo('initialization with subset of sequelize operations');
    test.todo('initialization with custom operations');
    
    test.todo('operator solver hook');
    test.todo('column mapper hook');
    test.todo('value mapper hook');

})