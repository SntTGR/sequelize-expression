// @ts-nocheck
try {
    const { ExpresionParser } = require('sequelize-expression');
    const symbols = {
        ['and'] : Symbol('and'),
        ['eq'] : Symbol('eq'),
    };
    const parser = new ExpresionParser(symbols);
    const output = parser.parse('col1 = 2, col2 = "4"');
    // Assertions
    const and = Object.getOwnPropertySymbols(output)[0];
    if(typeof and !== 'symbol') throw new Error('Assertion failure: And is not Symbol');
    if(typeof Object.getOwnPropertySymbols(output[and][0].col1)[0] !== 'symbol') throw new Error('Assertion failure: Eq 1 is not Symbol')
    if(typeof Object.getOwnPropertySymbols(output[and][1].col2)[0] !== 'symbol') throw new Error('Assertion failure: Eq 2 is not Symbol')
} catch (error) {
    throw new Error(`Test run of installed package failed: ${error.message}`)
}
