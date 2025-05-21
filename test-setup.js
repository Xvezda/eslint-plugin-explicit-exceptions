const test = require('node:test');
const { RuleTester } = require('@typescript-eslint/rule-tester');

// https://typescript-eslint.io/packages/rule-tester/#nodejs-nodetest
RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;
