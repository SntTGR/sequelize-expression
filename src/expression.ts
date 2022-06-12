import * as t from './tokenizer';
import * as p from './parser';

type Ops = {[ operation : string] : symbol };
export type Primary = {
    [ lValue : string ] : {
        [ operator : string ] : p.RightValue
    };
}
export type PrimaryValues = {
    lValue : string,
    operator : symbol,
    rValue : p.RightValue
}

export type PrimaryHook = ( arg0 : PrimaryValues ) => Primary | boolean;

// TODO: manage types

export class ExpresionParser {
    
    Op : Ops
    parser : p.Parser
    
    constructor(op : Ops) {        
        this.Op = {...op};
        this.parser = new p.Parser(op);
    }

    parse( input : string ) : p.OperationsTree {
        const tokens = t.tokenizer(input);
        return this.parser.parse(tokens);
    }
    
    private _hookPrimary : PrimaryHook = () => true;

    /**
     * Sets the primary hook, the function is called on the parsing result of each primary. Depending on the returned value of the hook different effects happen.
     * 
     * If the return value is a Primary, then it is replaced instead of the original parsed result.
     * If the return value is boolean true, then the original result is kept.
     * If the return value is false, the parser will try to safely delete the primary from the parsed result.
     * 
     * This hook is useful for column name authorization, resolving external columns/values and for casting values.
     */
    public set hookPrimary( hook : PrimaryHook ) {
        // TODO: multiple hooks support
        this.parser = new p.Parser(this.Op, { primary : hook });
        this._hookPrimary = hook;
    }
    

}

export default ExpresionParser;