import { ExpressionResult } from './errors';

import { Parser } from './parser'
import type { RightValue, LeftValue, Operator, PanicNotation, OperationsTree, ParserOps } from './parser';

import { tokenizer } from './tokenizer';

type Primary = { [ lValue : string ] : { [ operator : string ] : RightValue } }
type PrimaryValues = {
    lValue : LeftValue,
    operator : Operator,
    rValue : RightValue
}
type Ops = ParserOps

type errorCallback = (message : string) => PanicNotation

export type PrimaryHook = ( primaryValues : PrimaryValues, err : errorCallback ) => Primary | void;
export type OperatorHook = ( operatorString : string, err : errorCallback ) => symbol; 
export type Hooks = { primary : PrimaryHook, operator : OperatorHook }; 

export class ExpresionParser {
    
    parser : Parser

    /**
     * @callback errorCallback
     * @param {string} message - Message to show in the resulting error
     * @returns {PanicNotation} - Throwing it signals the parser to panic and make an early return
     * 
     * 
     * @callback PrimaryHook 
     * @param {PrimaryValues} primaryValues - Object holding the primary values
     * @param {LeftValue} primaryValues.lValue - Identifier of the column
     * @param {Operator} primaryValues.operator - Symbol of the sequelize operation
     * @param {RightValue} primaryValues.rValue - Value of the primary
     * @param {errorCallback} err - Callback to signal errors to the parser
     * @returns {Primary | void} - Returns the structure that the primary should take or if void, the parser tries to delete it safely from the resulting tree
     * 
     * @callback OperatorHook - Memoized operator resolver
     * @param {string} operatorString - String that the parser is trying to resolve
     * @param {errorCallback} - Callback to signal errors to the parser
     */

    private _hookPrimary : PrimaryHook | undefined;
    private _hookOperator : OperatorHook | undefined;
    
    /**
     * 
     * @param {Object} options
     * @param {Ops} [options.op] - Sequelize options mapper, if present it creates a default operator resolver using it.
     * @param {Object} [options.hooks] - Hooks to initialize the parser instead of the defaults.
     * @param {PrimaryHook} [options.hooks.primary] - Hook that resolves primaries
     * @param {OperatorHook} [options.hooks.operator] - Hook that resolves operators
     */
    constructor(options : { op? : Ops, hooks? : { primary? : PrimaryHook, operator? : OperatorHook } } ) {        

        // Construct default primary from Operators list
        if(options.op) {            
            const seqOps = options.op;

            this._hookOperator = (op, err) => { 
                const opSymbol = seqOps[op]; 
                if(!opSymbol) {
                    err(`Could not resolve operator: ${op}`);
                    return Symbol('noop')
                } else { 
                    return opSymbol;
                }
            }
        }

        if(options.hooks) {
            if(options.hooks.primary) this._hookPrimary = options.hooks.primary;
            if(options.hooks.operator) this._hookOperator = options.hooks.operator;
        }

        if (!this._hookOperator) throw new Error('Expected operator hook to be defined');
        if (!this._hookPrimary) this._hookPrimary = (p) => ({[p.lValue] : {[p.operator] : p.rValue }});

        this.parser = new Parser(this.getHookBundle());
    }

    parse( input : string ) : ExpressionResult<OperationsTree> {
        
        const tokensResult = tokenizer(input);
        if(!tokensResult.ok) return new ExpressionResult<OperationsTree>(tokensResult.getErrors());

        const operationResult = this.parser.parse(tokensResult.getResult());
        if(!operationResult.ok) {
            operationResult.getErrors().setInput(input as string);
            return new ExpressionResult<OperationsTree>(operationResult.getErrors())
        }

        return new ExpressionResult<OperationsTree>(operationResult.getResult());
    }
    
    /**
     * Sets the primary hook, the function is called just before the end of the primary resolution. Depending on the returned value of the hook different effects happen.
     * 
     * The returned value is written into the operations tree.
     * If instead the return value is void, the parser will try to safely delete the primary from the parsed result.
     * 
     * lValue corresponds to the column name / identifier
     * operator corresponds to the operator symbol
     * rValue corresponds to the value of the query
     * 
     * the err callback is used to report an error in the execution of the hook, passing a message to describe the error reason.
     * while the err callback returns an Error, throwing it results in an early termination of the parsing step. It is recomended
     * to not throw the returned err callback unless it is certain that the parser should panic.
     * 
     * This hook is useful for column name authorization/security, resolving external columns/values and for casting values.
     * @param {PrimaryHook} hook
     */
    public set hookPrimary( hook : PrimaryHook ) {
        this._hookPrimary = hook;
        this.updateChildsHooks();
    }
    
    /**
     * Resolves the operator string into a sequelize recognized symbol.
     * This function is internally memoized, so its expected to have a pure function
     * 
     * This hook is useful for operator aliases/mapping, subsetting sequelize operators, etc.
     * @param {OperatorHook} hook
     */
    public set hookOperator( hook : OperatorHook ) {
        this._hookOperator = hook;
        this.updateChildsHooks();
    }


    // NOTE: Unfortunate that cannot use references of functions, and have to rely on updating values. Might refactor later
    private getHookBundle() : Hooks {
        return {
            primary: this._hookPrimary as PrimaryHook,
            operator: this._hookOperator as OperatorHook
        }
    }
    private updateChildsHooks() {
        this.parser.hooks = this.getHookBundle();
    }

}

export default ExpresionParser;