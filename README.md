Aurora GraphQL
==============
[![npm version](https://badge.fury.io/js/%40carlipa%2Faurora-graphql.svg)](https://badge.fury.io/js/%40carlipa%2Faurora-graphql)
[![Build Status](https://travis-ci.org/carlipa/aurora-graphql.svg?branch=master)](https://travis-ci.org/carlipa/aurora-graphql)
[![Coverage Status](https://coveralls.io/repos/github/carlipa/aurora-graphql/badge.svg?branch=master)](https://coveralls.io/github/carlipa/aurora-graphql?branch=master)
[![Dependency Status](https://david-dm.org/carlipa/aurora-graphql.svg)](https://david-dm.org/carlipa/aurora-graphql)
[![devDependency Status](https://david-dm.org/carlipa/aurora-graphql/dev-status.svg)](https://david-dm.org/carlipa/aurora-graphql#info=devDependencies)

`Aurora GraphQL` is an express middleware that supports multiple projects, dynamically loaded.

### GraphQL - Relay

The goal of this library is to provide an easy and fast way to create a `GraphQL`, `Relay` compliant server, that can serve multiple projects.

### Express Middleware

`Aurora GraphQL` is an `express` middleware, that uses the content of `req.aurora` to operate.

# Usage

`Aurora GraphQL` expect its `req` to contains an `aurora` key, which is an object of 3 values: `project`, `storage` and `allowMutation`.

### Project

The project can either be hard loaded at the server start, or dynamically loaded with each request.

The `GraphQL` schema is created each time the `hash` value of a given project changes.

```javascript
project: {
  name: 'Project name',
  // A Hash of the classes definitions, if not present, it will be generated for each request
  hash: '123456789',
  // The classes
  classes: {
    // Classes definition version, used when upgrading
    version: 2,
    // The actual classes definitions
    definitions: { ... }
  }
}
```

Each time you change the project object in your database, you should create the hash value, and store it. That way, it won't be recreated each time a request is performed.

### Storage

To be as agnostic as possible, the storage part is not handled by `Aurora GraphQL`, you must create some methods in a previous middleware.

The `storage` object must have this shape:

```javascript
storage: {
  // A method that must return a mongoose model
  getModel: function(modelName, schema) { ... },
  // Files specific methods
  files: {
    // Takes one ID, returns one file metadata 
    getOneFileMetadataById: function(id) { ... },
    // Takes an array of IDs, returns an array of files metadata
    getManyFileMetadataByIds: function(ids) { ... }
  }
}
```

The `getModel` method should act like `mongoose`'s `model` method (http://mongoosejs.com/docs/models.html)

### Allow Mutation

Mutations are disabled by default, this is a safety lock.
Using your own authentication system, set the value of `req.aurora.allowMutation` to `true`, and they will be unlocked.
