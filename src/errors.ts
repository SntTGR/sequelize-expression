export class ExpressionError extends Error {
    
    position : number
    length : number
    
    constructor(message : string, position : number, length : number) {
        super(message);
        Object.setPrototypeOf(this, ExpressionError.prototype);
        this.position = position,
        this.length = length,
        this.name = this.constructor.name;
    }
}

export class ExpressionResult <Result> {

    hasErrors : boolean;
    error : ErrorBundle | undefined;
    result : Result | undefined;

    constructor( value : Result | ErrorBundle ) {
        if( value instanceof ErrorBundle ) {
            this.hasErrors = true;
            this.error = value;
        } else {
            this.hasErrors = false;
            this.result = value;
        }
    }

    get ok() : boolean {
        return !this.hasErrors;
    }

    getResult() : Result {
        if(!this.ok) throw new Error('Invalid result read');
        return this.result as Result;
    }
    getErrors() : ErrorBundle {
        if(this.ok) throw new Error('Invalid error read');
        return this.error as ErrorBundle;
    }

}

export class ErrorBundle {

    // NOTE: Might refactor later

    errors : ExpressionError[];
    private input : string;

    constructor(errors : ExpressionError[], input? : string) {
        this.errors = errors;
        this.input = input ? input : '';
    }

    setInput(input : string) {
        this.input = input;
    }

    toString() : string {
        return this.errors.map( (e,i) => {

            return `Err ${i}: ${e.name} - ${e.message}` + ` at ${e.position}:${e.position+e.length}` + '\n' +
            `${this.input}` + '\n' +
            ` `.repeat(e.position) + '^'.repeat(e.length)

        }).join('\n\n');
    }

}