import { validate } from '@andrei-tatar/nora-firebase-common';
import * as chai from 'chai';
import { getSafeUpdate } from './safe-update';

const expect = chai.expect;
describe('getSafeUpdate', () => {

    it('should convert text to numbers if current state has them as numbers', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                test: '123',
                test2: '123',
                child: {
                    test: '123',
                    test2: '123',
                },
            },
            currentState: {
                test: 123,
                test2: 'text',
                child: {
                    test: 123,
                    test2: 'text',
                },
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            test: 123,
            test2: '123',
            child: {
                test: 123,
                test2: '123',
            }
        });
    });

    it('should convert properties to boolean if current state has them as boolean', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                online: 1,
                child: {
                    online2: 'on',
                },
            },
            currentState: {
                online: false,
                child: {
                    online2: false,
                },
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            online: true,
            child: {
                online2: true,
            },
        });
    });

    it('should round numbers to 1 decimal', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                value: 1.1234,
            },
            currentState: {
                value: 1,
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            value: 1.1,
        });
    });

    it('should not round numbers if they are child in color', () => {
        const safeUpdate = {};

        getSafeUpdate({
            update: {
                color: {
                    value: 1.1234,
                }
            },
            currentState: {
                color: {
                    value: 1,
                },
            },
            isValid: () => true,
            safeUpdateObject: safeUpdate,
        });

        expect(safeUpdate).to.deep.equal({
            color: {
                value: 1.1234,
            }
        });
    });

    describe('with validation', () => {

        it('should remove invalid properties and warn', () => {
            const safeUpdate = {};
            const warnings: string[] = [];

            getSafeUpdate({
                update: {
                    missingProperty: 'this should not be copied',
                    color: {
                        missingProperty: 'this should not be copied',
                        spectrumHsv: {
                            missingProperty: 'this should not be copied',
                        },
                    },
                },
                currentState: {
                    online: true,
                    color: {
                        spectrumHsv: {
                            hue: 2,
                            saturation: 3,
                            value: .5
                        },
                    },
                },
                isValid: () => validate(['action.devices.traits.ColorSetting'], 'state', safeUpdate).valid,
                warn: prop => warnings.push(prop),
                safeUpdateObject: safeUpdate,
            });

            expect(safeUpdate).to.deep.equal({});
            expect(warnings).to.have.members([
                'msg.payload.missingProperty',
                'msg.payload.color',
            ]);
        });
    });
});

