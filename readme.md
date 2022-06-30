# Sequelize Expression
[![npm version](https://badgen.net/npm/v/sequelize-expression)](https://www.npmjs.com/package/sequelize-expression)

Sequelize expression is a dependency-free module that generates sequelize-like filters with an expression front end.

It also has a *resolvers*/hooks API to modify the generation of its filters. Useful for implementing authorization of columns, external dependency resolution and just about any other requirement that may come up when using expressions.

## Quickstart Example
```js
const { Expression } = require('sequelize-expression');
const { Op } = require('sequelize');

// Initialize with default resolvers.
const parser = new Expression({ op : Op });

const result = await parser.parse('firstName like "John%" | ( age > 18 & id_school = null )');
if (!result.ok) {
    console.log( result.getErrors() ); // Formated parsing errors
    return;
}
    
const filters = result.getResult();

await sequelize.models.User.findAll({
    where: filters
})
```

in the previous example `filters` would equal to
```js
const filters = {
    [Op.or] : [
        { 'firstName' : { [Op.like] : "John%" } },
        { 
            [Op.and] : [
                { 'age' : { [Op.gt] : 18 } },
                { 'id_school' : { [Op.eq] : null } },
            ]
        }
    ]
}
```

## Syntax       

Syntax consists of [primaries](#primaries) connected by [logical operators](#logic-operators).

### Logic Operators

|     | valid values | Alias to |
| --- | :----------: | :------: |
| OR  |      \|      |    or    |
| AND |     & ,      |   and    |
| NOT |      !       |   not    |

### Primaries

Primaries are the individual conditions of **column** **operator** **value**. For example `firstName like "John%"`.

These values map to syntax of a **leftValue** an **operator** and a **rightValue** respectively.

#### Left values
Left values are the column descriptors, they accept:
- any *identifier* that don't match a reserved [keyword](todo). For example: `firstName`
- string literals using the "" syntax. For example: `"id_school"`

#### Operators
Operators are the descriptors of sequelize Operators, they accept:
- any *identifier* that doesn't match a reserved [keyword](todo) For example: `like`
- string literals using the "" syntax. For example: `"startsWith"`

#### Righ values
Values accept:
- null keyword: `null`
- any *identifier* that doesn't match a reserved [keyword](todo) For example: `john`
- string literals using the "" syntax. For example: `"john"`
- numbers: `0.125`, `-54`, `321`
- arrays: `[null,"John",45,[]]`

### Arrays

Arrays consist of brackets with rValues separated by either comma or semicolons. Just like javascript the ending comma/semicolon is redundant.

Examples: 
- `[1,2,3]`
- `["val";identifier;null;[1,2,3];2.0;]`

### String literals

String literals are values enclosed by " quotes. Quotes can be escaped with \"

Examples:
- `"John \"Rocket\" Doe"`
- `"null"`

### Precedence & Associativity

Everything is associative from left-to-right.
Precedence table:
|     |                                 |
| --- | :-----------------------------: |
|     |               or                |
|     |               and               |
|     |               not               |
|     | operators, values, [], (), null |

## Output

The output of parser is a promise of an ExpressionResult instance. The method is async because the resolvers may be asynchronous.
promise may reject in case of an uncaught error in the parsing process.
Otherwise syntax arrors are provided by the ExpressionResult instance.

## Result API

The Result class provides an ok method to check if the parsing result is correct. It works similarly to the `fetch` api.

Example
```js
const expressionResultInstance = await expression.parse('age > 10');
expressionResultInstance.ok // should be true;
const filtersTree = expressionResultInstance.getResult(); // { 'age' : { [Op.gt] : 10 } }
```
```js
const expressionResultInstance = await expression.parse('null nilOperator 5');
expressionResultInstance.ok // should be false;
const syntaxErrors = expressionResultInstance.getErrors();

syntaxErrors.toString();
// Err 0: ParserError - Expected an identifier at 0:4
// null nilOperator 5
// ^^^^
//
// Err 1: ParserError - Could not resolve operator: nilOperator at 5:16
// null nilOperator 5
//      ^^^^^^^^^^^
```

Should you call getErrors() when result is ok, or when you call getResults when result is not ok: an invalid read error is thrown.
```js
const expressionResultInstance = await expression.parse('null > 10');
expressionResultInstance.ok // should be false;
expressionResultInstance.getResults() // throws.
```

## Resolvers

This module is focused in parsing expression so they can be passed onto sequelize. But that is hardly enough, what if you took user input as an expression? you would need to implement security and to implement security for each column you need to know how to identify a column in an expression (or rather in the output tree).

The resolver API is designed to inject functionality such that you could easily implement security, external resource resolving, or to even adapt the parser for compatibility patching.

Also the operator resolver allows the module to be dependency-free, as to not chain it to a single sequelize version (or even sequelize itself).

### API

```js
const primaryResolver = (p, err) => {
    return {[p.lValue] : {[p.operator] : p.rValue }};
}
const operatorResolver = (operator, err) => {     
    if(!Op[operator]) {
        err(`Could not resolve operator: ${operator}`); // soft error.
        return Symbol('noop') // still needs to return something.
    } else { 
        return opSymbol;
    }
}

const parser = new Expression({ resolvers: { primary : primaryResolver, operator : operatorResolver } });
```

You can also set the resolvers after construction

```js
const parser = new Expression({ op : Op }) // use default resolvers

parser.resolverPrimary = (p, err) => {
    const can = canConsultColumn(p.lValue);
    if(!can) throw err(`Cannot consult column: ${p.lValue}!`); // hard error.

    return {[p.lValue] : {[p.operator] : p.rValue }}
};
```

> When passing op into the Expression constructor a default operatorResolver is created using op as a mapper, if you don't provide Op to the constructor you have to provide an operatorResolver implementation in the resolvers option.

#### Errors

To signal resolver errors, a callback function is generally provided as the last argument in the resolver function.
this error callback accepts a string message.

```js
(p, err) => {
    
    if (Array.isArray(p.rValue) && p.rValue.length === 0) {
        throw err('Cannot accept empty array values!');
    }

    if (p.lValue === 'credit_card') {
        err('Cannot access credit_card column!'); 
        return // while the resolver returns something, because theres an error the resulting output tree is inaccesible. So feel free to return garbage values.   
    }

    return {[p.lValue] : {[p.operator] : p.rValue}}
};
```

Output using the example above
```js

const result = await parser.parse('credit_card gt 0 & firstName in [] & credit_card gt 10')

result.getErrors().toString();
// Err 0: ParserError - Cannot access credit_card column! at 0:16
// credit_card gt 0 & firstName in [] & credit_card gt 10
// ^^^^^^^^^^^^^^^^
//
// Err 1: ParserError - Cannot accept empty array values! at 19:34
// credit_card gt 0 & firstName in [] & credit_card gt 10
//                    ^^^^^^^^^^^^^^^

```

The difference that you should consider when using a hard error vs a soft error is the question of if it is meaningful to continue to parse the rest of the expression when the error is encountered. It is recommended to always go for soft errors.

> Note that hard errors dont early return when using an async resolver as they get transformed into a rejection. Consider returning promises by hand. 

#### Operator resolver

The operator resolver is responsible for generate/getting the symbols that sequelize uses. This operator is internally memoized when trying to parse an expression, meaning that if there are two *eq* operators in the expression the resolver is ran once.

First parameter is `op`: operator string that needs to be resolved into a symbol.
Second parameter is `err`: error callback that accepts an error message. 

callback should return a symbol.

The default operator resolver
```js
// Created only if Op is passed in the constructor

// Transform all op keys to lowercase
const defaultLowerOps : Ops = {};
Object.entries(options.op).forEach( ([key, value]) => defaultLowerOps[key.toLowerCase()] = value );

this._resolverOperator = (op, err) => {
    // Transform op to lowercase as to have case insensitive operators.
    const opSymbol = defaultLowerOps[op.toLowerCase()];
    if(!opSymbol) {
        err(`Could not resolve operator: ${op}`);
        return Symbol('noop')
    } else { 
        return opSymbol;
    }
}
```

#### Primary resolver

The primary resolver is responsible for generating the final structure of a single 'query' or condition.

First parameter is `p`: an object containing the `lValue` (string), `operator` (symbol) and `rValue` (string,array,null,number)
Second parameter is `err`: error callback that accepts an error message.

Callback should return one of these options
- An object, preferably it has to be of the structure { lValue : { operator : rValue } }
- undefined or void, it signals that this primary should be cleaned up. As if it was never in the expression to begin with.
- Promise of an object or undefined|void, meaning that it supports an async callback.

The default primary resolver
```js
(p) => ({[p.lValue] : {[p.operator] : p.rValue }})
```

##### Returning void

Returning nothing from the callback it signals to the parser that this primary should be cleaned up. This clean up process can cause the logical operators to collapse and simplify,
meaning that the resulting tree is as if the primary was never in the expression to begin with.

##### Security example
```js
async (p,err) => {
    const can = await canQueryColumn(p.lValue);
    if(!can) return;

    return {[p.lValue] : {[p.operator] : p.rValue }}
}
```

##### External resolution example

```js
async (p,err) => {
    
    if(isExternalResource(p.lValue)) {
        const externalColumn = getExternalColumn(p.lValue)
        let ids;
        try {
            ids = await fetchIdsOfExternalResource({ lValue: externalColumn, operator: p.operator, rValue: p.rValue });            
        } catch (error) {
            throw err(error.message);
        }
        const internalColumn = getInternalColumn(p.lValue)
        return { [internalColumn] : { [Op['in']] : ids } }
    }
    return { [p.lValue] : { [p.operator] : p.rValue } };
}
```
