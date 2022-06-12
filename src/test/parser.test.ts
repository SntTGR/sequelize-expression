import { Parser, ParserOps } from '../parser';
import type { Token,ValueToken } from '../tokenizer';
import { Op } from 'sequelize';

describe.skip('parser', () => {
    
    let parser : Parser;

    beforeAll( () => {
        parser = new Parser(Op as unknown as ParserOps);
    })

    test.each([
        [ 'column EQ 2', [{ type: 'IDENTIFIER', value: 'column' } as ValueToken, { type: 'EQ' }, { type: 'IDENTIFIER', value: '2'} as ValueToken, { type: 'END' }], ({ column : { [Op.eq.toString()] : 2 } }) ],
    ])('%s', (_, tokenList, expectedTree) => {
        
        const operationTree = parser.parse(tokenList as Token[]);

        expect(operationTree).toBeDefined();
        expect(operationTree).toBe(expectedTree);

    });

    test.todo('Parser panic');
    test.todo('Parser error');
})