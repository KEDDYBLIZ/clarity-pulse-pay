import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Can create payment agreement",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10)
            ], wallet_1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectUint(0);
        
        // Verify agreement details
        let getAgreement = chain.callReadOnlyFn(
            'pulse-pay',
            'get-agreement',
            [types.uint(0)],
            wallet_1.address
        );
        
        let agreement = getAgreement.result.expectSome().expectTuple();
        assertEquals(agreement['amount'], types.uint(1000));
        assertEquals(agreement['frequency'], types.uint(10));
        assertEquals(agreement['active'], true);
    }
});

Clarinet.test({
    name: "Can execute payment when due",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        // Create agreement
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10)
            ], wallet_1.address)
        ]);
        
        // Mine blocks to make payment due
        chain.mineEmptyBlockUntil(20);
        
        // Execute payment
        let paymentBlock = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'execute-payment', [
                types.uint(0)
            ], wallet_1.address)
        ]);
        
        paymentBlock.receipts[0].result.expectOk().expectBool(true);
        
        // Verify payment executed
        let getAgreement = chain.callReadOnlyFn(
            'pulse-pay',
            'get-agreement',
            [types.uint(0)],
            wallet_1.address
        );
        
        let agreement = getAgreement.result.expectSome().expectTuple();
        assertEquals(agreement['last-paid'], types.uint(20));
    }
});

Clarinet.test({
    name: "Can cancel agreement",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get('wallet_1')!;
        const wallet_2 = accounts.get('wallet_2')!;
        
        // Create agreement
        let block = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'create-agreement', [
                types.principal(wallet_2.address),
                types.uint(1000),
                types.uint(10)
            ], wallet_1.address)
        ]);
        
        // Cancel agreement
        let cancelBlock = chain.mineBlock([
            Tx.contractCall('pulse-pay', 'cancel-agreement', [
                types.uint(0)
            ], wallet_1.address)
        ]);
        
        cancelBlock.receipts[0].result.expectOk().expectBool(true);
        
        // Verify agreement cancelled
        let getAgreement = chain.callReadOnlyFn(
            'pulse-pay',
            'get-agreement',
            [types.uint(0)],
            wallet_1.address
        );
        
        let agreement = getAgreement.result.expectSome().expectTuple();
        assertEquals(agreement['active'], false);
    }
});