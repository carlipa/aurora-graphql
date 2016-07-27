import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';

import {
  connectionArgs,
  connectionFromArray,
} from 'graphql-relay';

import {
  camelCase,
  compact,
  each,
  isArray,
  keys,
  map,
  pickBy,
  startsWith,
  upperFirst,
} from 'lodash';

import { ClassesFieldsHelper } from './';

/**
 * For each class, generate an object that contains information and methods for GraphQL
 * @private
 */
export default function generateClassesHelpers(classesFieldsHelper) {
  if (!classesFieldsHelper instanceof ClassesFieldsHelper) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  const classesNames = keys(classesFieldsHelper._classes.definitions).map((x) => x.toLowerCase());

  each(classesNames, (className) => {
    each(ClassesFieldsHelper.RESERVED_CLASS_PREFIX, (prefix) => {
      if (startsWith(className.toLowerCase(), prefix.toLowerCase())) {
        throw new Error(`Parse error: Cannot use reserved prefix "${prefix}" in "${className}"`);
      }
    });

    if (ClassesFieldsHelper.RESERVED_CLASS_NAMES.map((x) => x.toLowerCase()).indexOf(className.toLowerCase()) !== -1) {
      throw new Error(`Parse error: Cannot use reserved class name "${className}"`);
    }
  });

  // Add the special "file" className
  classesNames.push('file');

  each(classesFieldsHelper._classes.definitions, (classDefinition, className) => {
    let { fields: fieldsDefinitions, options } = classDefinition;

    // If no options are needed, one can only use fieldDefs
    if (!fieldsDefinitions && !options) {
      fieldsDefinitions = classDefinition;
      options = {};
    }

    /**
     * Return the GraphQL fields of the class
     * @param resolveRelations if false, the relations fields will be string or list of strings
     * if false, they will be GraphQL type (default: true)
     * @param disableNonNull if true, required field won't be GraphQLNonNull (default: false)
     */
    const getFields = ({ resolveRelations = true, disableNonNull = false } = {}) => {
      const fields = {};

      each(fieldsDefinitions, (field, fieldName) => {
        const _fieldName = camelCase(fieldName);
        if (ClassesFieldsHelper.RESERVED_FIELDS.indexOf(_fieldName) !== -1) {
          throw new Error(`Parse error: Cannot use reserved field "${fieldName}"`);
        }
        each(ClassesFieldsHelper.RESERVED_FIELDS_PREFIX, (prefix) => {
          if (startsWith(_fieldName.toLowerCase(), prefix.toLowerCase())) {
            throw new Error(`Parse error: Cannot use reserved prefix "${prefix}" in field "${_fieldName}"`);
          }
        });

        // Fields
        if (isArray(field)) {
          // If array
          if (field.length !== 1) {
            throw new Error('Parse error: Array must have a length of 1');
          }
          // You can use the object form, or directly enter the type
          const fieldArrayData = (typeof field[0] === 'string') ? { type: field[0] } : field[0];
          // If array of relation
          if (fieldArrayData.type.toLowerCase() === 'relation') {
            if (!fieldArrayData.ref) {
              throw new Error('Parse error: "relation" needs a "ref"');
            }

            const _ref = fieldArrayData.ref.toLowerCase();
            if (classesNames.indexOf(_ref) === -1) {
              throw new Error(`Parse error: Found a reference to missing class "${_ref}"`);
            }

            if (resolveRelations) {
              fields[_fieldName] = {
                type: classesFieldsHelper._connections[_ref],
                args: connectionArgs,
                resolve: (fieldsList, args) => connectionFromArray(
                  map(fieldsList[_fieldName], (id) => classesFieldsHelper._getClassDataById(_ref, id)),
                  args
                ),
              };
            } else {
              fields[_fieldName] = {
                type: new GraphQLList(GraphQLID),
              };
            }
          } else if (fieldArrayData.type) {
            fields[_fieldName] = {
              type: new GraphQLList(ClassesFieldsHelper._graphQLTypeFromString(fieldArrayData.type)),
            };
          } else {
            throw new Error(`Parse error: cannot parse field ${fieldName} in ${className}`);
          }
        } else {
          // You can use the object form, or directly enter the type
          const _field = (typeof field === 'string') ? { type: field } : field;

          // If leaf
          if (_field.type.toLowerCase() === 'relation') {
            // If relation
            if (!field.ref) {
              throw new Error('Parse error: "relation" needs a "ref"');
            }

            const _ref = _field.ref.toLowerCase();
            if (classesNames.indexOf(_ref) === -1) {
              throw new Error(`Parse error: Found a reference to missing class "${_ref}"`);
            }

            if (resolveRelations) {
              fields[_fieldName] = {
                type: _field.required && !disableNonNull
                  ? new GraphQLNonNull(classesFieldsHelper._types[_ref])
                  : classesFieldsHelper._types[_ref],
                resolve: (fieldsList) => classesFieldsHelper._getClassDataById(_ref, fieldsList[_fieldName]),
              };
            } else {
              fields[_fieldName] = {
                type: _field.required && !disableNonNull ? new GraphQLNonNull(GraphQLID) : GraphQLID,
              };
            }
          } else if (_field.type) {
            fields[_fieldName] = {
              type: _field.required && !disableNonNull
                ? new GraphQLNonNull(ClassesFieldsHelper._graphQLTypeFromString(_field.type))
                : ClassesFieldsHelper._graphQLTypeFromString(_field.type),
            };
          } else {
            throw new Error(`Parse error: cannot parse field ${fieldName} in ${className}`);
          }
        }

        // Add the field description
        fields[_fieldName].description = field.description;
      });

      return fields;
    };

    /**
     * Returns an array that contains all the fields that are relation (one-to-one and one-to-many)
     */
    const getFieldsWithRelations = () => compact(map(fieldsDefinitions, (field, fieldName) => {
      if (isArray(field) && field.length) {
        // You can use the object form, or directly enter the type
        const fieldArrayData = (typeof field[0] === 'string') ? { type: field[0] } : field[0];

        if (fieldArrayData.type.toLowerCase() === 'relation') {
          return {
            fieldName: camelCase(fieldName),
            className: fieldArrayData.ref,
          };
        }
      } else if (field.type && field.type.toLowerCase() === 'relation') {
        return {
          fieldName: camelCase(fieldName),
          className: field.ref,
        };
      }
      return null;
    }));

    /**
     * Returns an array which contains the name of the field that are not arrays nor relation
     */
    const getSortableFieldsName = () => compact(map(fieldsDefinitions, (field, fieldName) => {
      if (isArray(field) || (field.type && field.type.toLowerCase() === 'relation')) {
        return null;
      }
      return camelCase(fieldName);
    }));

    /**
     * Returns a collection which contains the field that are not arrays
     */
    const getFilterableFields = () => pickBy(fieldsDefinitions, (field) => !(isArray(field)));

    classesFieldsHelper.addClassHelper({
      name: upperFirst(className),
      plural: options && options.plural,
      getFields,
      getFieldsWithRelations,
      getSortableFieldsName,
      getFilterableFields,
    });
  });
}
