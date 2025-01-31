# PulsePay

A decentralized recurring payment system built on Stacks. This contract enables automated recurring payments between parties with configurable payment schedules.

## Features
- Create recurring payment agreements
- Configure payment amount and frequency
- Schedule payments with start and end times
- Set maximum number of payments
- Auto-execute payments on schedule
- Update payment schedules
- Cancel agreements
- View payment history

## Payment Scheduling
Payments can now be scheduled with the following parameters:
- Start time: When payments can begin (in block height)
- End time: When payments must end (in block height)
- Maximum payments: Limit the total number of payments
- Payment frequency: Number of blocks between payments

## Requirements
- Clarinet
- Stacks wallet

## Usage Examples

### Create Agreement with Schedule
```clarity
(contract-call? .pulse-pay create-agreement 
    recipient-address
    u1000             ;; amount
    u10               ;; frequency (blocks)
    u100              ;; start at block 100
    u1000             ;; end at block 1000
    u5                ;; max 5 payments
)
```

### Update Payment Schedule
```clarity
(contract-call? .pulse-pay update-schedule
    u0                ;; agreement ID
    u200              ;; new start time
    u2000             ;; new end time
    u10               ;; new max payments
)
```
