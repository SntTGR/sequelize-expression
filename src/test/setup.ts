import { ExpressionResult } from "../errors";

interface CustomMatchers<R = unknown> {
    toResultHaveErrors(e? : string[]): R;
}
  
declare global {
    namespace jest {
        interface Expect extends CustomMatchers {}
        interface Matchers<R> extends CustomMatchers<R> {}
        interface InverseAsymmetricMatchers extends CustomMatchers {}
    }
}

function isArrayOfString(arr : any) : arr is Array<string> {
    if (Array.isArray(arr)){
        if(arr.length === 0) return true;
        return arr.every( v => typeof v === 'string' );
    }
    return false

}

expect.extend({
    toResultHaveErrors(r : unknown, e : unknown) {

        if (!(r instanceof ExpressionResult)) throw new Error('Received value is not ExpressionResult instance');
        if(typeof e !== 'undefined') {
            if(!isArrayOfString(e)) throw new Error('Expected error array is not string array');
        }
        
                                
        const expectedErrorsList = e && e.length > 0 ? `[${e.join(',')}]` : undefined
        
        const expectedResultMessage = 'result ' + 
            (this.isNot && !expectedErrorsList ? 
                `with status ${this.utils.BOLD_WEIGHT('OK')}` :
                (this.isNot ? `without` : 'with') + ` errors${expectedErrorsList ? `: ${expectedErrorsList}` : ''}`
            ) 
            + '.';

        const receivedResultMessage = 'result with ' + 
            (r.ok ? 
                `status ${this.utils.BOLD_WEIGHT('OK')}` : 
                `errors: [${r.getErrors().errors.map(e => e.message).join(',')}]`)
            + '.';

        const basicReturnMessage = 
            `Expected: ${this.utils.EXPECTED_COLOR(expectedResultMessage)}\n`+
            `Received: ${this.utils.RECEIVED_COLOR(receivedResultMessage)}`;

        if (r.ok) return { message: () => basicReturnMessage, pass: false }

        const recievedErrorList = r.getErrors().errors;

        if (e && e.length > 0){
            const a = recievedErrorList.map(e => e.message).sort();
            const b = e.sort()

            return {
                message: () => 
                    `${basicReturnMessage}\n`+
                    `\n`+
                    `${this.utils.diff(b,a)}`,
                pass : this.equals(a,b),
            }
        }
        
        return {
            message: () => basicReturnMessage,
            pass: true,
        }
    }
});

// ts-jest gets confused with setup file. Exporting and importing manually fixes type errors.
export default true;