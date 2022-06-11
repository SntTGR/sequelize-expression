import { parser } from '../parser'
import type { Token,ValueToken } from '../tokenizer';
import { Op } from 'sequelize';




describe.skip('parser', () => {
    
    
    test.skip.each([
        {  }
    ])('%s', (query) => {
        
        

    });


    test.skip('column EQ 2', () => {

        const tokenList : Token[] = [
            { type: 'IDENTIFIER', value: 'column' } as ValueToken,
            { type: 'EQ' },
            { type: 'IDENTIFIER', value: '2'} as ValueToken,
            { type: 'END' },
        ]

        const eq = Op.eq.toString()

        const optionTree = parser(tokenList)

        // NOTE: maybe refactor this

        expect(optionTree).toBeDefined();
        expect(optionTree).toHaveProperty('column');
        expect(optionTree).toHaveProperty(`column.${eq}`);
        expect(optionTree).toHaveProperty(`column.${eq}`, '2');
        
    })
})