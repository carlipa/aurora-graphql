import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spy } from 'sinon';

import AuroraGraphQL from '../';
import { ObjectIDType } from '../src/types/common';

// Chai As Promised configuration
chai.use(chaiAsPromised);

const badProjectReservedPrefixData = require('./fixtures/bad_project_reserved_prefix.json');
const badProjectReservedClassNameData = require('./fixtures/bad_project_reserved_className.json');

describe('Aurora - GraphQL', () => {
  let auroraGraphQL;

  describe('getSchema', () => {
    beforeEach(() => {
      auroraGraphQL = new AuroraGraphQL();
      spy(AuroraGraphQL, '_getSchema');
    });

    afterEach(() => {
      AuroraGraphQL._getSchema.restore();
    });

    it('should be called when a schema is requested', () => {
      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: {},
            hash: '12345',
          },
        },
        storage: {},
      });

      assert.isTrue(AuroraGraphQL._getSchema.called);
    });

    it('should be called again only with a new configHash', () => {
      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: {},
            hash: '12345',
          },
        },
        storage: {},
      });

      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: {},
            hash: '12345',
          },
        },
        storage: {},
      });

      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: {},
            hash: '67890',
          },
        },
        storage: {},
      });

      assert.isTrue(AuroraGraphQL._getSchema.calledTwice);
    });

    it('should be called again only with a new classes definitions if no configHash', () => {
      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: { test1: {} },

          },
        },
        storage: {},
      });

      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: { test1: {} },
          },
        },
        storage: {},
      });

      auroraGraphQL._getSchemaForProject({
        project: {
          classes: {
            definitions: { test2: {} },
          },
        },
        storage: {},
      });

      assert.isTrue(AuroraGraphQL._getSchema.calledTwice);
    });

    it('should throw when using reserved prefix', () => {
      assert.throw(() => {
        auroraGraphQL._getSchemaForProject({
          project: badProjectReservedPrefixData,
          storage: {},
        });
      }, /Cannot use reserved prefix/);
    });

    it('should throw when using reserved className', () => {
      assert.throw(() => {
        auroraGraphQL._getSchemaForProject({
          project: badProjectReservedClassNameData,
          storage: {},
        });
      }, /Cannot use reserved class name/);
    });
  });
});
