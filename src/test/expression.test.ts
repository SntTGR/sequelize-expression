import Expression from '../expression'
import { Op } from 'sequelize';

describe('sequelize-expression.js', () => {

    test('plain initialization', () => {
        expect(() => new Expression({})).toThrow();
    });

    describe('complete parsing tests', () => {
        const parser = new Expression({op:Op as any});

        test('Precedence of logical operators', () => {
            const t1 = parser.parse('(a eq 1 and b eq 2) or c eq 3').getResult();
            const t2 = parser.parse(' a eq 1 and b eq 2  or c eq 3').getResult();
            expect(t1).toStrictEqual(t2);
        });
    })

    describe('Hooks', () => {
        
        let parser : Expression;

        beforeEach(() => {
            parser = new Expression( { op:Op as any } );
        })

        test('Changing hooks', () => {
            
            const t1 = parser.parse('a eq 1').getResult();
            
            parser.hookOperator = (op) => Op['eq'];

            const t2 = parser.parse('a foo 1').getResult();
            
            expect(t1).toStrictEqual(t2);
        })

        test('Hook primary error', () => {

            parser.hookPrimary = (p, err) => {
                if(p.rValue === 1) err('Soft error!');
                return { [Symbol('test')] : { 'test' : 'test' } }
            }
            const t = parser.parse('c lt 1 AND b eq 3, a eq 1');

            expect(t.ok).toBe(false);
            t.getErrors().toString()
            expect(t.getErrors().errors.map(e => e.message)).toEqual(['Soft error!','Soft error!']);

        })

        test('Hook hard error', () => {

            parser.hookPrimary = (p, err) => {
                if(p.rValue === 1) throw err('Hard error!');
                return { [Symbol('test')] : { 'test' : 'test' } }
            }

            const t = parser.parse('c lt 1 AND b eq 3, a eq 1');

            expect(t.ok).toBe(false);
            t.getErrors().toString();
            expect(t.getErrors().errors.map(e => e.message)).toEqual(['Hard error!']);
            
        })

        test('Hook primary ignore', () => {

            parser.hookPrimary = p => {
                if(p.rValue !== 1) return { [p.operator] : { [p.lValue] : p.rValue } }
            }

            const t = parser.parse('c lt 1 AND b eq 3, a eq 1');

            expect(t.ok).toBe(true);
            expect(t.getResult()).toEqual({
                [Op['eq']] : { 'b' : 3 }
            })

        })

    })

    test.todo('initialization with sequelize operations');
    test.todo('initialization with subset of sequelize operations');
    test.todo('initialization with custom operations');
    
})