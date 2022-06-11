import type { Op } from 'sequelize/types/operators';

class ExpresionParser {
    
    Op : typeof Op
    
    constructor(op : typeof Op ) {        
        this.Op = {...op};
    }

    // TODO: initialize parser and tokenizer with ops from constructor
    // Tokenizer definition
    // Set the tokens types

    // TODO: implement hooks
}

export default ExpresionParser;