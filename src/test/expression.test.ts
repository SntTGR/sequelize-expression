import Expression from '../expression'
import { Op } from 'sequelize';

describe('sequelize-expression.js', () => {

    test('plain initialization', () => {
        const expression = new Expression({});
    });

    describe('complete parsing tests', () => {
        const parser = new Expression(Op as any);;

        test('Precedence of logical operators', () => {
            const t1 = parser.parse('(a eq 1 and b eq 2) or c eq 3').getResult();
            const t2 = parser.parse(' a eq 1 and b eq 2  or c eq 3').getResult();
            expect(t1).toStrictEqual(t2);
        });
    })

    test.todo('initialization with sequelize operations');
    test.todo('initialization with subset of sequelize operations');
    test.todo('initialization with custom operations');
    
    test.todo('operator solver hook');
    test.todo('column mapper hook');
    test.todo('value mapper hook');

})