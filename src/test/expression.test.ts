import Expression from '../expression'
import { DataTypes, Model, Op, Sequelize } from 'sequelize';

import _ from './setup';

describe('sequelize-expression.js', () => {

    test('plain initialization', () => {
        expect(() => new Expression({})).toThrow();
    });

    describe('complete parsing tests', () => {
        const parser = new Expression({op:Op as any});

        test('Precedence of logical operators', async () => {
            const t1R = (await parser.parse('(a eq 1 and b eq 2) or c eq 3'));
            expect(t1R).not.toResultHaveErrors();
            const t1 = t1R.getResult();
            
            const t2R = (await parser.parse(' a eq 1 and b eq 2  or c eq 3'));
            expect(t2R).not.toResultHaveErrors();
            const t2 = t2R.getResult();

            expect(t1).toStrictEqual(t2);
        });
    })

    describe('in-memory integration test', () => {
        
        let db : Sequelize;
        let expression : Expression;

        beforeAll(async () => {
            db = new Sequelize('sqlite::memory:',
            {
                logging: false
            }
            );
            await db.authenticate();

            // Set up expression instance
            expression = new Expression({op: Op as any});

            // Set up models
            const User = db.define('User', {
                firstName: { type: DataTypes.STRING, primaryKey : true, allowNull : false },
                lastName : { type: DataTypes.STRING }
            },
            {
                createdAt: false,
                updatedAt: false,
            })

            await User.sync({force : true});

            // Set up dataset
            await User.bulkCreate([
                { firstName: 'Emily',     lastName: 'Hemmings' },
                { firstName: 'Amelia',    lastName: 'Young' },
                { firstName: 'Andrew',    lastName: 'Robertson' },
                { firstName: 'Steven',    lastName: 'Mathis' },
                { firstName: 'Kevin',     lastName: 'Springer' },
                { firstName: 'Evan',      lastName: null },
                { firstName: 'Adam',      lastName: null },
                { firstName: 'Deirdre',   lastName: 'Fisher' },
                { firstName: 'Joan',      lastName: 'Edmunds' },
                { firstName: 'Keith',     lastName: 'Burgess' },
                { firstName: 'Cameron',   lastName: 'Tucker' },
                { firstName: 'Felicity',  lastName: 'Hodges' },
                { firstName: 'Abigail',   lastName: 'Peake' },
                { firstName: 'Michael',   lastName: 'Miller' },
                { firstName: 'Luke',      lastName: 'Allan' },
                { firstName: 'Karen',     lastName: null },
                { firstName: 'Dorothy',   lastName: 'Roberts' },
                { firstName: 'Melanie',   lastName: 'Cornish' },
                { firstName: 'Rose',      lastName: 'Harris' },
                { firstName: 'Victoria',  lastName: 'Bell' },
                { firstName: 'Trevor',    lastName: null },
                { firstName: 'Sebastian', lastName: 'Burgess' },
                { firstName: 'Neil',      lastName: 'Thomson' },
                { firstName: 'Anne',      lastName: 'Coleman' },
            ]);
        })

        test.each([
            ['Filter by name or name', 'firstName = Amelia | firstName = Karen', 
                [
                    {firstName: 'Amelia',     lastName : 'Young'},
                    {firstName : 'Karen',     lastName: null}
                ]
            ],
            ['Filter by null lastName', 'lastName eq null', 
                [
                    { firstName: 'Evan',      lastName: null },
                    { firstName: 'Adam',      lastName: null },
                    { firstName: 'Karen',     lastName: null },
                    { firstName: 'Trevor',    lastName: null },
                ]
            ],
            ['Filter firstName second to last has e', 'firstName like %e_', 
                [
                    { firstName: 'Andrew',    lastName: 'Robertson' },
                    { firstName: 'Steven',    lastName: 'Mathis' },
                    { firstName: 'Michael',   lastName: 'Miller' },
                    { firstName: 'Karen',     lastName: null },
                ]
            ],
            ['Filter lastName in array of cases', 'lastName in [Harris,Bell,Peake]', 
                [
                    { firstName: 'Rose',      lastName: 'Harris' },
                    { firstName: 'Abigail',   lastName: 'Peake' },
                    { firstName: 'Victoria',  lastName: 'Bell' },
                ]
            ],
        ])( '%s: %s', async (_, exp, expected) => {

            const result = await expression.parse(exp);
            
            expect(result).not.toResultHaveErrors();

            const filters = result.getResult();

            const dbResult = await db.models.User.findAll({
                where: filters as any,
                raw: true
            });

            expect(dbResult).toBeDefined();

            dbResult.sort( (a,b) => ((a as any).firstName as string).localeCompare((b as any).lastName) );
            expected.sort( (a,b) => ((a as any).firstName as string).localeCompare((b as any).lastName) );

            expect(dbResult).toEqual(expected);
        })

        afterAll(() => {
            db.close();
        })
    })

    describe('Hooks', () => {
        
        let parser : Expression;

        beforeEach(() => {
            parser = new Expression( { op:Op as any } );
        })

        test('Changing hooks', async () => {
            
            const t1R = (await parser.parse('a eq 1'));
            expect(t1R).not.toResultHaveErrors();
            const t1 = t1R.getResult();
            
            parser.hookOperator = (op) => Op['eq'];

            const t2R = (await parser.parse('a foo 1'))
            expect(t2R).not.toResultHaveErrors();
            const t2 = t2R.getResult();
            
            expect(t1).toStrictEqual(t2);
        })

        test('Hook primary error', async () => {

            parser.hookPrimary = (p, err) => {
                if(p.rValue === 1) err('Soft error!');
                return { [Symbol('test')] : { 'test' : 'test' } }
            }
            const t = await parser.parse('c lt 1 AND b eq 3, a eq 1');

            expect(t).toResultHaveErrors(['Soft error!','Soft error!']);

        })

        test('Hook hard error', async () => {

            parser.hookPrimary = (p, err) => {
                if(p.rValue === 1) throw err('Hard error!');
                return { [Symbol('test')] : { 'test' : 'test' } }
            }

            const t = await parser.parse('c lt 1 AND b eq 3, a eq 1');

            expect(t).toResultHaveErrors(['Hard error!']);
            
        })

        test('Hook primary ignore', async () => {

            parser.hookPrimary = p => {
                if(p.rValue !== 1) return { [p.operator] : { [p.lValue] : p.rValue } }
            }

            const t = await parser.parse('c lt 1 AND b eq 3, a eq 1');

            expect(t).not.toResultHaveErrors();
            expect(t.getResult()).toEqual({
                [Op['eq']] : { 'b' : 3 }
            })

        })

    })

    
    
    test.todo('test with sequelize in-memory database')
    
})