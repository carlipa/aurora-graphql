import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spy } from 'sinon';

import AuroraGraphQL from '../src';

// Chai As Promised configuration
chai.use(chaiAsPromised);

const goodProjectData = require('./fixtures/project.json');
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
      auroraGraphQL._getClassesForProject({
        project: {
          hash: '12345',
          classes: {
            definitions: {},
          },
        },
        storage: {},
      });

      assert.isTrue(AuroraGraphQL._getSchema.called);
    });

    it('should be called again only with a new configHash', () => {
      auroraGraphQL._getClassesForProject({
        project: {
          hash: '12345',
          classes: {
            definitions: {},
          },
        },
        storage: {},
      });

      auroraGraphQL._getClassesForProject({
        project: {
          hash: '12345',
          classes: {
            definitions: {},
          },
        },
        storage: {},
      });

      auroraGraphQL._getClassesForProject({
        project: {
          hash: '67890',
          classes: {
            definitions: {},
          },
        },
        storage: {},
      });

      assert.isTrue(AuroraGraphQL._getSchema.calledTwice);
    });

    it('should be called again only with a new classes definitions if no projectHash', () => {
      auroraGraphQL._getClassesForProject({
        project: {
          classes: {
            definitions: { test1: {} },

          },
        },
        storage: {},
      });

      auroraGraphQL._getClassesForProject({
        project: {
          classes: {
            definitions: { test1: {} },
          },
        },
        storage: {},
      });

      auroraGraphQL._getClassesForProject({
        project: {
          classes: {
            definitions: { test2: {} },
          },
        },
        storage: {},
      });

      assert.isTrue(AuroraGraphQL._getSchema.calledTwice);
    });

    it('should generate a GraphQL JSON schema', () => {
      const projectClasses = auroraGraphQL._getClassesForProject({
        project: goodProjectData,
        storage: {},
      });

      return projectClasses.getSchemaJSON().then((result) => {
        assert.deepProperty(result, 'data.__schema');
      });
    });

    it('should throw when using reserved prefix', () => {
      assert.throw(() => {
        auroraGraphQL._getClassesForProject({
          project: badProjectReservedPrefixData,
          storage: {},
        });
      }, /Cannot use reserved prefix/);
    });

    it('should throw when using reserved className', () => {
      assert.throw(() => {
        auroraGraphQL._getClassesForProject({
          project: badProjectReservedClassNameData,
          storage: {},
        });
      }, /Cannot use reserved class name/);
    });
  });
});
