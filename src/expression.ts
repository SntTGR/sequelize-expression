import { ErrorBundle, ExpressionResult } from './errors';
import { Parser } from './parser'
import { tokenizer } from './tokenizer';

import type { RightValue, LeftValue, Operator, PanicNotation, OperationsTree, ParserOps } from './parser';


export type Primary = { [ lValue : string ] : { [ operator : string ] : RightValue } }
type PrimaryValues = {
    lValue : LeftValue,
    operator : Operator,
    rValue : RightValue
}
type Ops = ParserOps

type errorCallback = (message : string) => PanicNotation

export type PrimaryResolver = ( primaryValues : PrimaryValues, err : errorCallback ) => Promise<Primary | void> | Primary | void ;
export type OperatorResolver = ( operatorString : string, err : errorCallback ) => symbol; 
export type Resolvers = { primary : PrimaryResolver, operator : OperatorResolver }; 

export class Expression {
    
    private parser : Parser

    /**
     * @callback errorCallback
     * @param {string} message - Message to show in the resulting error
     * @returns {PanicNotation} - Throwing it signals the parser to panic and make an early return
     * 
     * 
     * @callback PrimaryResolver 
     * @param {PrimaryValues} primaryValues - Object holding the primary values
     * @param {LeftValue} primaryValues.lValue - Identifier of the column
     * @param {Operator} primaryValues.operator - Symbol of the sequelize operation
     * @param {RightValue} primaryValues.rValue - Value of the primary
     * @param {errorCallback} err - Callback to signal errors to the parser
     * @returns {Primary | void} - Returns the structure that the primary should take or if void, the parser tries to delete it safely from the resulting tree
     * 
     * @callback OperatorResolver - Memoized operator resolver
     * @param {string} operatorString - String that the parser is trying to resolve
     * @param {errorCallback} - Callback to signal errors to the parser
     */

    private _resolverPrimary : PrimaryResolver | undefined;
    private _resolverOperator : OperatorResolver | undefined;
    
    /**
     * 
     * @param {Object} options
     * @param {Ops} [options.op] - Sequelize options mapper, if present it creates a default operator resolver using it.
     * @param {Object} [options.resolvers] - Resolvers to initialize the parser instead of the defaults.
     * @param {PrimaryResolver} [options.resolvers.primary] - Resolver that resolves primaries
     * @param {OperatorResolver} [options.resolvers.operator] - Resolver that resolves operators
     */
    constructor(options : { op? : Ops, resolvers? : { primary? : PrimaryResolver, operator? : OperatorResolver } } ) {        

        // Construct default primary from Operators list
        if(options.op) {            
            // lowerCase keys copy
            const defaultLowerOps : Ops = {};
            Object.entries(options.op).forEach( ([key, value]) => defaultLowerOps[key.toLowerCase()] = value );
            
            this._resolverOperator = (op, err) => {     
                const opSymbol = defaultLowerOps[op.toLowerCase()];
                if(!opSymbol) {
                    err(`Could not resolve operator: ${op}`);
                    return Symbol('noop')
                } else { 
                    return opSymbol;
                }
            }
        }

        if(options.resolvers) {
            if(options.resolvers.primary) this._resolverPrimary = options.resolvers.primary;
            if(options.resolvers.operator) this._resolverOperator = options.resolvers.operator;
        }

        if (!this._resolverOperator) throw new Error('Expected operator resolver to be defined');
        if (!this._resolverPrimary) this._resolverPrimary = (p) => ({[p.lValue] : {[p.operator] : p.rValue }});

        this.parser = new Parser(this.getResolverBundle());
    }

    async parse( input : string ) : Promise<ExpressionResult<OperationsTree>> {
        
        const expressionErrors = new ErrorBundle([], input);

        // Tokenizer Step

        const tokensResult = tokenizer(input);
        if(!tokensResult.ok) {
            expressionErrors.push(...tokensResult.getErrors().errors);
            return new ExpressionResult<OperationsTree>(expressionErrors);
        }

        const tokenList = tokensResult.getResult();

        // Parser Step

        const operationResult = await this.parser.parse(tokenList);
        if(!operationResult.ok) {
            expressionErrors.push(...operationResult.getErrors().errors);
            return new ExpressionResult<OperationsTree>(expressionErrors);
        }

        const parserTree = operationResult.getResult();

        // Results

        if (expressionErrors.hasErrors()) return new ExpressionResult<OperationsTree>(expressionErrors);
        return new ExpressionResult<OperationsTree>(parserTree);

    }

    /**
     * Sets the primary resolver, the function is called just before the end of the primary resolution. Depending on the returned value of the resolver different effects happen.
     * 
     * The returned value is written into the operations tree.
     * If instead the return value is void, the parser will try to safely delete the primary from the parsed result.
     * 
     * lValue corresponds to the column name / identifier
     * operator corresponds to the operator symbol
     * rValue corresponds to the value of the query
     * 
     * the err callback is used to report an error in the execution of the resolver, passing a message to describe the error reason.
     * while the err callback returns an Error, throwing it results in an early termination of the parsing step. It is recomended
     * to not throw the returned err callback unless it is certain that the parser should panic.
     * 
     * This resolver is useful for column name authorization/security, resolving external columns/values and for casting values.
     * @param {PrimaryResolver} resolver
     */
    public set resolverPrimary( resolver : PrimaryResolver ) {
        this._resolverPrimary = resolver;
        this.updateChildsResolvers();
    }
    
    /**
     * Resolves the operator string into a sequelize recognized symbol.
     * This function is internally memoized, so its expected to have a pure function
     * 
     * This resolver is useful for operator aliases/mapping, subsetting sequelize operators, etc.
     * @param {OperatorResolver} resolver
     */
    public set resolverOperator( resolver : OperatorResolver ) {
        this._resolverOperator = resolver;
        this.updateChildsResolvers();
    }


    // NOTE: Unfortunate that cannot use references of functions, and have to rely on updating values. Might refactor later
    private getResolverBundle() : Resolvers {
        return {
            primary: this._resolverPrimary as PrimaryResolver,
            operator: this._resolverOperator as OperatorResolver
        }
    }
    private updateChildsResolvers() {
        this.parser.resolvers = this.getResolverBundle();
    }

}

export default Expression;