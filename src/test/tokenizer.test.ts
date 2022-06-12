import { tokenizer } from '../tokenizer';

describe.skip('tokenizer', () => {
    test('column EQ 2', () => {

        const tokens = tokenizer('column EQ 2');

        // NOTE: Maybe refactor this, I need to check the value too

        expect( tokens ).not.toHaveLength(0);

        expect( tokens[0].type ).toBe( 'IDENTIFIER' );
        expect( tokens[1].type ).toBe( 'EQ' );
        expect( tokens[2].type ).toBe( 'IDENTIFIER' );
        
    })

    test.todo('Tokenizer error')
})