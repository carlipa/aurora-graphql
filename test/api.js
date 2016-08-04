// Test deps
import request from 'supertest-as-promised';
import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Deps
import Promise from 'bluebird';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { pick } from 'lodash';
import { Types } from 'mongoose';

// Components
import AuroraStorage from './helpers/storage';
import AuroraGraphQL from '../src';
import ClassSchema from '../src/schemas/class.schema';

// Promisification
Promise.promisifyAll(fs);

// Chai As Promised configuration
chai.use(chaiAsPromised);

const projectData = require('./fixtures/project.json');
const databaseData = require('./fixtures/database.json');

describe('Aurora - GraphQL - API', () => {
  let app;
  let auroraStorage;
  let auroraGraphQL;

  let User;
  let News;
  let Comment;

  let user1;
  let user2;
  let news1;
  let news2;
  let comment1;
  let comment2;
  let comment3;

  let file1;
  let file2;

  const file1Path = path.join(__dirname, 'fixtures/kitty.png');
  const file2Path = path.join(__dirname, 'fixtures/project.json');

  async function prepareModels() {
    const storage = await auroraStorage.getStorage(projectData);

    User = storage.getModel('User', ClassSchema);
    News = storage.getModel('News', ClassSchema);
    Comment = storage.getModel('Comment', ClassSchema);
  }

  async function emptyDatabase(storage) {
    await User.remove({});
    await Comment.remove({});
    await News.remove({});

    await Promise
      .fromNode((callback) => storage.gfs.files.find({}).toArray(callback))
      .map((file) => storage.gfs.removeAsync({ _id: file._id }));
  }

  before(async function before() {
    // Start the storage engine
    auroraStorage = new AuroraStorage();
    auroraGraphQL = new AuroraGraphQL();

    // Prepare the GraphQL server
    app = express();

    // Fake mutation authorization if 'X-Mutation' header is present
    app.use((req, res, next) => {
      if (req.get('X-Mutation') === 'allow') {
        // eslint-disable-next-line no-param-reassign
        req.aurora = { ...req.aurora, allowMutation: true };
      }

      next();
    });

    // Fake a project parsing
    app.use((req, res, next) => {
      // eslint-disable-next-line no-param-reassign
      req.aurora = { ...req.aurora, project: projectData };
      next();
    });

    app.use(auroraStorage.getMiddleware());
    app.use(auroraGraphQL.getMiddleware());

    // Prepare the data models
    await prepareModels();
  });

  beforeEach(async function beforeEach() {
    // Fill the database
    const storage = await auroraStorage.getStorage(projectData);
    await emptyDatabase(storage);

    // File 1
    await new Promise((resolve, reject) => {
      const writestream = storage.gfs.createWriteStream({
        filename: 'kitty.png',
        content_type: 'image/png',
      });
      fs.createReadStream(file1Path).pipe(writestream);
      writestream.on('close', (file) => {
        file1 = file;
        resolve();
      });
      writestream.on('error', reject);
    });

    // File 2
    await new Promise((resolve, reject) => {
      const writestream = storage.gfs.createWriteStream({
        filename: 'project.json',
        content_type: 'application/json',
      });
      fs.createReadStream(file2Path).pipe(writestream);
      writestream.on('close', (file) => {
        file2 = file;
        resolve();
      });
      writestream.on('error', reject);
    });

    // Update user1 with file1 ID as avatar relation
    databaseData.user1.avatar = file1._id.toString();
    // Update user2 with broken avatar relation
    databaseData.user2.avatar = '123456789012';

    databaseData.news1.files = [file1._id.toString(), file2._id.toString()];

    user1 = new User({
      data: databaseData.user1,
      _classVersion: 1,
    });
    await user1.save();

    user2 = new User({
      data: databaseData.user2,
      _classVersion: 1,
    });
    await user2.save();

    comment1 = new Comment({
      data: { ...databaseData.comment1, author: user1._id },
      _classVersion: 1,
    });
    await comment1.save();

    comment2 = new Comment({
      data: { ...databaseData.comment2, author: user2._id },
      _classVersion: 1,
    });
    await comment2.save();

    comment3 = new Comment({
      data: { ...databaseData.comment3, author: '123456789012' },
      _classVersion: 1,
    });
    await comment3.save();

    news1 = new News({
      data: {
        ...databaseData.news1,
        author: user1._id,
        comments: [
          comment1._id,
          comment2._id,
        ],
      },
      _classVersion: 1,
    });
    await news1.save();

    news2 = new News({
      data: {
        ...databaseData.news2,
        author: user2._id,
        comments: [
          comment1._id,
        ],
      },
      _classVersion: 1,
    });
    await news2.save();
  });

  describe('Queries', () => {
    describe('One', () => {
      it('should query the project data', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            project: _project {
              name
              hash
              classes {
                version
                definitions
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.project');
            const project = res.body.data.project;

            assert.deepEqual(project, pick(projectData, ['name', 'hash', 'classes']));
          });
      });

      it('should query one user by its Mongo ID', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            user (id: "${user1._id}") {
              mongoId
              name
              vip
              age
              popularity
              dynamic
              _classVersion
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.user');
            const user = res.body.data.user;

            assert.strictEqual(user.mongoId, user1._id.toString());
            assert.strictEqual(user.name, user1.data.name);
            assert.strictEqual(user.vip, user1.data.vip);
            assert.strictEqual(user.age, user1.data.age);
            assert.strictEqual(user.popularity, user1.data.popularity);
            assert.strictEqual(user._classVersion, user1._classVersion);

            assert.isObject(user.dynamic);
            assert.deepEqual(user.dynamic, user1.data.dynamic);
          });
      });

      it('should query one user by its GraphQL ID', () => {
        return Promise.resolve()
          .then(() => {
            // First, query the user by its Mongo ID creation
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                user (id: "${user1._id}") {
                  id
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.user');
                const user = res.body.data.user;

                return user.id;
              });
          })
          .then((graphQLId) => {
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                user (id: "${graphQLId}") {
                  id
                  mongoId
                  name
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.user');
                const user = res.body.data.user;

                assert.strictEqual(user.id, graphQLId);
                assert.strictEqual(user.mongoId, user1._id.toString());
                assert.strictEqual(user.name, user1.data.name);
              });
          });
      });

      it('should query one user by its name', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            user (name: "${user1.data.name}") {
              mongoId
              name
              vip
              age
              popularity
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.user');
            const user = res.body.data.user;

            assert.strictEqual(user.mongoId, user1._id.toString());
            assert.strictEqual(user.name, user1.data.name);
            assert.strictEqual(user.vip, user1.data.vip);
            assert.strictEqual(user.age, user1.data.age);
            assert.strictEqual(user.popularity, user1.data.popularity);
          });
      });

      it('should query one news by its author MongoID', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news (author: "${user1._id.toString()}") {
              mongoId
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.mongoId, news1._id.toString());
          });
      });

      it('should query one news by its author MongoID', () => {
        const user1GraphQLID = new Buffer(`User:${user1._id.toString()}`).toString('base64');

        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news (author: "${user1GraphQLID}") {
              mongoId
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.mongoId, news1._id.toString());
          });
      });

      it('should query one news by its comments\' MongoID ', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news (comments: ["${comment1._id.toString()}", "${comment2._id.toString()}"]) {
              mongoId
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.mongoId, news1._id.toString());
          });
      });

      it('should query one user and its file relation', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            user (id: "${user1._id}") {
              mongoId
              name
              vip
              age
              popularity
              avatar {
                mongoId
                filename
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.user');
            const user = res.body.data.user;

            assert.strictEqual(user.mongoId, user1._id.toString());
            assert.strictEqual(user.name, user1.data.name);
            assert.strictEqual(user.vip, user1.data.vip);
            assert.strictEqual(user.age, user1.data.age);
            assert.strictEqual(user.popularity, user1.data.popularity);

            assert.strictEqual(user.avatar.mongoId, file1._id.toString());
            assert.strictEqual(user.avatar.filename, file1.filename);
          });
      });

      it('should query one news and its files relations', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news (id: "${news1._id}") {
              mongoId
              title
              files {
                edges {
                  node {
                    mongoId
                    filename
                  }
                }
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.mongoId, news1._id.toString());
            assert.strictEqual(news.title, news1.data.title);

            assert.strictEqual(news.files.edges[0].node.mongoId, file1._id.toString());
            assert.strictEqual(news.files.edges[0].node.filename, file1.filename);
            assert.strictEqual(news.files.edges[1].node.mongoId, file2._id.toString());
            assert.strictEqual(news.files.edges[1].node.filename, file2.filename);
          });
      });

      it('should show "null" when a class relation is broken', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            comment (id: "${comment3._id}") {
              mongoId
              author {
                mongoId
                name
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.comment');
            const comment = res.body.data.comment;
            const errors = res.body.errors;

            assert.strictEqual(comment.mongoId, comment3._id.toString());
            assert.strictEqual(comment.author, null);

            assert.isDefined(errors);
            assert.strictEqual(errors.length, 1);
            assert.property(errors[0], 'message');
            assert.strictEqual(errors[0].message, 'Object "User" not found');
          });
      });

      it('should show "null" when a file relation is broken', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            user (id: "${user2._id}") {
              mongoId
              avatar {
                mongoId
                filename
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.user');
            const user = res.body.data.user;
            const errors = res.body.errors;

            assert.strictEqual(user.mongoId, user2._id.toString());
            assert.strictEqual(user.avatar, null);

            assert.isDefined(errors);
            assert.strictEqual(errors.length, 1);
            assert.property(errors[0], 'message');
            assert.strictEqual(errors[0].message, 'File not found');
          });
      });

      it('should query one raw user by its Mongo ID', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            user: userRaw (id: "${user1._id}")
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.user');
            const user = res.body.data.user;

            assert.isObject(user1);

            assert.strictEqual(user.mongoId, user1._id.toString());
            assert.strictEqual(user.name, user1.data.name);
          });
      });
    });

    describe('Many', () => {
      it('should query all users', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 2);
            assert.strictEqual(users.edges.length, 2);

            assert.strictEqual(users.edges[0].node.mongoId, user1._id.toString());
            assert.strictEqual(users.edges[0].node.name, user1.data.name);
            assert.strictEqual(users.edges[1].node.mongoId, user2._id.toString());
            assert.strictEqual(users.edges[1].node.name, user2.data.name);
          });
      });

      it('should query all users, sorted by name (desc)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (orderBy: NAME_DESC) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 2);
            assert.strictEqual(users.edges.length, 2);

            assert.strictEqual(users.edges[0].node.mongoId, user2._id.toString());
            assert.strictEqual(users.edges[0].node.name, user2.data.name);
            assert.strictEqual(users.edges[1].node.mongoId, user1._id.toString());
            assert.strictEqual(users.edges[1].node.name, user1.data.name);
          });
      });

      it('should query users, filtered by age (lt: 42)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (filters: {
                age: {
                  lt: 42
                }
              }) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 1);
            assert.strictEqual(users.edges.length, 1);

            assert.strictEqual(users.edges[0].node.mongoId, user1._id.toString());
            assert.strictEqual(users.edges[0].node.name, user1.data.name);
          });
      });

      it('should query users, filtered by age (gte: 42)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (filters: {
                age: {
                  gte: 42
                }
              }) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 1);
            assert.strictEqual(users.edges.length, 1);

            assert.strictEqual(users.edges[0].node.mongoId, user2._id.toString());
            assert.strictEqual(users.edges[0].node.name, user2.data.name);
          });
      });

      it('should query users, filtered by name (in: ["User 1", "User 3"])', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (filters: {
                name: {
                  in: ["User 1", "User 3"]
                }
              }) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 1);
            assert.strictEqual(users.edges.length, 1);

            assert.strictEqual(users.edges[0].node.mongoId, user1._id.toString());
            assert.strictEqual(users.edges[0].node.name, user1.data.name);
          });
      });

      it('should query users, filtered by name (regexp: /^\\w{4} 1/i)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (filters: {
                name: {
                  regexp: "/^\\\\w{4} 1/i"
                }
              }) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 1);
            assert.strictEqual(users.edges.length, 1);

            assert.strictEqual(users.edges[0].node.mongoId, user1._id.toString());
            assert.strictEqual(users.edges[0].node.name, user1.data.name);
          });
      });

      it('should not query users, filtered by name with 0 matching regexp (regexp: /^\\w{3} 1/i)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (filters: {
                name: {
                  regexp: "/^\\\\w{3} 1/i"
                }
              }) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            const users = res.body.data.users;

            assert.strictEqual(users.totalCount, 0);
            assert.strictEqual(users.edges.length, 0);
          });
      });

      it('should not query users, filtered by name with malformed regexp (regexp: ^\\w{3} 1)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            users (filters: {
                name: {
                  regexp: "^\\\\w{3} 1"
                }
              }) {
              edges {
                node {
                  mongoId
                  name
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.users');
            assert.deepProperty(res, 'body.errors');

            const users = res.body.data.users;
            assert.isNull(users);
          });
      });

      it('should query news, filtered by their author (one author)', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news: multipleNews (filters: {
                author: {
                  eq: "${user1._id.toString()}"
                }
              }) {
              edges {
                node {
                  mongoId
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.totalCount, 1);
            assert.strictEqual(news.edges.length, 1);

            assert.strictEqual(news.edges[0].node.mongoId, news1._id.toString());
          });
      });

      it('should query news, filtered by their author (one author - GraphQL ID)', () => {
        const user2GraphQLID = new Buffer(`User:${user2._id.toString()}`).toString('base64');

        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news: multipleNews (filters: {
                author: {
                  eq: "${user2GraphQLID}"
                }
              }) {
              edges {
                node {
                  mongoId
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.totalCount, 1);
            assert.strictEqual(news.edges.length, 1);

            assert.strictEqual(news.edges[0].node.mongoId, news2._id.toString());
          });
      });

      it('should query news, filtered by their author (two authors)', () => {
        const user2GraphQLID = new Buffer(`User:${user2._id.toString()}`).toString('base64');

        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            news: multipleNews (filters: {
                author: {
                  in: ["${user1._id.toString()}", "${user2GraphQLID}"]
                }
              }) {
              edges {
                node {
                  mongoId
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.news');
            const news = res.body.data.news;

            assert.strictEqual(news.totalCount, 2);
            assert.strictEqual(news.edges.length, 2);

            assert.strictEqual(news.edges[0].node.mongoId, news1._id.toString());
            assert.strictEqual(news.edges[1].node.mongoId, news2._id.toString());
          });
      });

      it('should query all news', () => {
        return request(app)
          .post('/graphql')
          .set('Content-Type', 'application/json')
          .send({
            query: `{
            multipleNews {
              edges {
                node {
                  mongoId
                  title
                  body
                  author {
                    mongoId
                    name
                  }
                  arrayOfString1
                  arrayOfString2
                  comments {
                    edges {
                      node {
                        mongoId
                        author {
                          mongoId
                          name
                        }
                        body
                      }
                    }
                  }
                }
              }
              totalCount
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.multipleNews');
            const news = res.body.data.multipleNews;

            assert.strictEqual(news.totalCount, 2);
            assert.strictEqual(news.edges.length, 2);

            assert.deepEqual(news.edges[0].node, {
              mongoId: news1._id.toString(),
              title: news1.data.title,
              body: news1.data.body,
              author: {
                mongoId: user1._id.toString(),
                name: user1.data.name,
              },
              arrayOfString1: news1.data.arrayOfString1,
              arrayOfString2: news1.data.arrayOfString2,
              comments: {
                edges: [
                  {
                    node: {
                      mongoId: comment1._id.toString(),
                      body: comment1.data.body,
                      author: {
                        mongoId: user1._id.toString(),
                        name: user1.data.name,
                      },
                    },
                  },
                  {
                    node: {
                      mongoId: comment2._id.toString(),
                      body: comment2.data.body,
                      author: {
                        mongoId: user2._id.toString(),
                        name: user2.data.name,
                      },
                    },
                  },
                ],
              },
            });

            assert.deepEqual(news.edges[1].node, {
              mongoId: news2._id.toString(),
              title: news2.data.title,
              body: null,
              author: {
                mongoId: user2._id.toString(),
                name: user2.data.name,
              },
              arrayOfString1: news2.data.arrayOfString1,
              arrayOfString2: null,
              comments: {
                edges: [
                  {
                    node: {
                      mongoId: comment1._id.toString(),
                      body: comment1.data.body,
                      author: {
                        mongoId: user1._id.toString(),
                        name: user1.data.name,
                      },
                    },
                  },
                ],
              },
            });
          });
      });
    });
  });

  describe('Mutations', () => {
    describe('Create', () => {
      it('should fail without correct header', () => {
        return request(app)
          .post('/graphql')
          .set('X-Mutation', null)
          .set('Content-Type', 'application/json')
          .send({
            query: `mutation {
                mutation: createUser (input: {
                  name: "TEST"
                  clientMutationId: "1"
                }) {
                  clientMutationId
                  createdUser {
                    id
                  }
                }
              }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.mutation');
            const mutation = res.body.data.mutation;

            assert.isNull(mutation);
          });
      });

      it('should create a user', () => {
        const dynamicData = {
          key7: {
            'key7-1': 'string',
            'key7-2': {
              'key7-2-1': 1234,
            },
          },
        };

        return Promise.resolve()
          .then(() => {
            const wrapMixed = (mixed) => JSON.stringify(JSON.stringify(mixed));

            // New user creation
            return request(app)
              .post('/graphql')
              .set('X-Mutation', 'allow')
              .set('Content-Type', 'application/json')
              .send({
                query: `mutation {
                mutation: createUser (input: {
                  name: "TEST"
                  clientMutationId: "1"
                  dynamic: ${wrapMixed(dynamicData)}
                }) {
                  clientMutationId
                  createdUser {
                    id
                    mongoId
                    name
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.mutation');
                const mutation = res.body.data.mutation;
                const createdUser = mutation.createdUser;

                assert.strictEqual(mutation.clientMutationId, '1');
                assert.strictEqual(createdUser.name, 'TEST');

                assert.property(createdUser, 'id');
                assert.property(createdUser, 'mongoId');

                return createdUser.mongoId;
              });
          })
          .then((userMongoId) => {
            // Query the created user
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                user (id: "${userMongoId}") {
                  mongoId
                  name
                  dynamic
                  _classVersion
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.user');
                const user = res.body.data.user;

                assert.strictEqual(user.mongoId, userMongoId);
                assert.strictEqual(user.name, 'TEST');
                assert.strictEqual(user._classVersion, projectData.classes.version);

                assert.isObject(user.dynamic);
                assert.deepEqual(user.dynamic, dynamicData);
              });
          });
      });

      it('should create a news', () => {
        const newsData = {
          title: 'Test Title',
          body: 'Test Body',
          arrayOfString1: ['str001', 'str002'],
          arrayOfString2: ['str003', 'str004'],
          author: user1._id.toString(),
          comments: [
            comment1._id.toString(),
            comment2._id.toString(),
          ],
        };

        return Promise.resolve()
          .then(() => {
            // News creation
            return request(app)
              .post('/graphql')
              .set('X-Mutation', 'allow')
              .set('Content-Type', 'application/json')
              .send({
                query: `mutation {
                mutation: createNews (input: {
                  title: "${newsData.title}"
                  body: "${newsData.body}"
                  arrayOfString1: ${JSON.stringify(newsData.arrayOfString1)}
                  arrayOfString2: ${JSON.stringify(newsData.arrayOfString2)}
                  author: "${newsData.author}"
                  comments: ${JSON.stringify(newsData.comments)}
                  clientMutationId: "1"
                }) {
                  clientMutationId
                  createdNews {
                    id
                    mongoId
                    title
                    body
                    author {
                      mongoId
                      name
                    }
                    arrayOfString1
                    arrayOfString2
                    comments {
                      edges {
                        node {
                          mongoId
                          author {
                            mongoId
                            name
                          }
                          body
                        }
                      }
                    }
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.mutation');
                const mutation = res.body.data.mutation;
                const createdNews = mutation.createdNews;

                assert.strictEqual(mutation.clientMutationId, '1');
                assert.strictEqual(createdNews.title, newsData.title);

                assert.deepEqual(createdNews, {
                  id: createdNews.id,
                  mongoId: createdNews.mongoId,
                  title: newsData.title,
                  body: newsData.body,
                  author: {
                    mongoId: newsData.author,
                    name: user1.data.name,
                  },
                  arrayOfString1: newsData.arrayOfString1,
                  arrayOfString2: newsData.arrayOfString2,
                  comments: {
                    edges: [
                      {
                        node: {
                          mongoId: newsData.comments[0],
                          body: comment1.data.body,
                          author: {
                            mongoId: user1._id.toString(),
                            name: user1.data.name,
                          },
                        },
                      },
                      {
                        node: {
                          mongoId: newsData.comments[1],
                          body: comment2.data.body,
                          author: {
                            mongoId: user2._id.toString(),
                            name: user2.data.name,
                          },
                        },
                      },
                    ],
                  },
                });

                assert.property(createdNews, 'id');
                assert.property(createdNews, 'mongoId');

                return createdNews.mongoId;
              });
          })
          .then((newsMongoId) => {
            // Query the created news
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                news (id: "${newsMongoId}") {
                  mongoId
                  title
                  author {
                    mongoId
                  }
                  _classVersion
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.news');
                const news = res.body.data.news;

                assert.strictEqual(news.mongoId, newsMongoId);
                assert.strictEqual(news.title, newsData.title);
                assert.strictEqual(news.author.mongoId, newsData.author);
                assert.strictEqual(news._classVersion, projectData.classes.version);
              });
          });
      });
    });

    describe('Update', () => {
      it('should update a news (only its title and author, without affecting the other fields)', () => {
        return request(app)
          .post('/graphql')
          .set('X-Mutation', 'allow')
          .set('Content-Type', 'application/json')
          .send({
            query: `mutation {
            mutation: updateNews (input: {
              id: "${news1._id}"
              title: "UPDATE"
              author: "${user2._id}"
              clientMutationId: "1"
            }) {
              updatedNews {
                mongoId
                title
                body
                author {
                  mongoId
                }
                _classVersion
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.mutation');
            const updatedNews = res.body.data.mutation.updatedNews;

            assert.strictEqual(updatedNews.mongoId, news1._id.toString());
            // Should have updated the title
            assert.strictEqual(updatedNews.title, 'UPDATE');
            // Should have updated the author
            assert.strictEqual(updatedNews.author.mongoId, user2._id.toString());
            // Shouldn't have altered the body
            assert.strictEqual(updatedNews.body, news1.data.body);
            // Should have altered the _classVersion
            assert.strictEqual(updatedNews._classVersion, projectData.classes.version);
          });
      });
    });

    describe('Replace', () => {
      it('should replace a news', () => {
        return request(app)
          .post('/graphql')
          .set('X-Mutation', 'allow')
          .set('Content-Type', 'application/json')
          .send({
            query: `mutation {
            mutation: replaceNews (input: {
              id: "${news1._id}"
              title: "UPDATE"
              author: "${user2._id}"
              clientMutationId: "1"
            }) {
              replacedNews {
                mongoId
                title
                body
                author {
                  mongoId
                }
                _classVersion
              }
            }
          }`,
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .then((res) => {
            assert.deepProperty(res, 'body.data.mutation');
            const replacedNews = res.body.data.mutation.replacedNews;

            assert.strictEqual(replacedNews.mongoId, news1._id.toString());
            // Should have updated the title
            assert.strictEqual(replacedNews.title, 'UPDATE');
            // Should have updated the author
            assert.strictEqual(replacedNews.author.mongoId, user2._id.toString());
            // Should have altered the body
            assert.notEqual(replacedNews.body, news1.data.body);
            assert.strictEqual(replacedNews.body, null);
            // Should have altered the _classVersion
            assert.strictEqual(replacedNews._classVersion, projectData.classes.version);
          });
      });

      it('should create a user using replace (upsert) if no "id" is provided', () => {
        const dynamicData = {
          key7: {
            'key7-1': 'string',
            'key7-2': {
              'key7-2-1': 1234,
            },
          },
        };

        return Promise.resolve()
          .then(() => {
            const wrapMixed = (mixed) => JSON.stringify(JSON.stringify(mixed));

            // New user creation
            return request(app)
              .post('/graphql')
              .set('X-Mutation', 'allow')
              .set('Content-Type', 'application/json')
              .send({
                query: `mutation {
                mutation: replaceUser (input: {
                  name: "TEST"
                  clientMutationId: "1"
                  dynamic: ${wrapMixed(dynamicData)}
                }) {
                  clientMutationId
                  createdUser: replacedUser {
                    id
                    mongoId
                    name
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.mutation');
                const mutation = res.body.data.mutation;
                const createdUser = mutation.createdUser;

                assert.strictEqual(mutation.clientMutationId, '1');
                assert.strictEqual(createdUser.name, 'TEST');

                assert.property(createdUser, 'id');
                assert.property(createdUser, 'mongoId');

                return createdUser.mongoId;
              });
          })
          .then((userMongoId) => {
            // Query the created user
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                user (id: "${userMongoId}") {
                  mongoId
                  name
                  dynamic
                  _classVersion
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.user');
                const user = res.body.data.user;

                assert.strictEqual(user.mongoId, userMongoId);
                assert.strictEqual(user.name, 'TEST');
                assert.strictEqual(user._classVersion, projectData.classes.version);

                assert.isObject(user.dynamic);
                assert.deepEqual(user.dynamic, dynamicData);
              });
          });
      });

      it('should create a user using replace (upsert) if the provided "id" is not used yet', () => {
        const dynamicData = {
          key7: {
            'key7-1': 'string',
            'key7-2': {
              'key7-2-1': 1234,
            },
          },
        };

        return Promise.resolve()
          .then(() => {
            const wrapMixed = (mixed) => JSON.stringify(JSON.stringify(mixed));

            const mongoId = new Types.ObjectId();

            // New user creation
            return request(app)
              .post('/graphql')
              .set('X-Mutation', 'allow')
              .set('Content-Type', 'application/json')
              .send({
                query: `mutation {
                mutation: replaceUser (input: {
                  id: "${mongoId}"
                  name: "TEST"
                  clientMutationId: "1"
                  dynamic: ${wrapMixed(dynamicData)}
                }) {
                  clientMutationId
                  createdUser: replacedUser {
                    id
                    mongoId
                    name
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.mutation');
                const mutation = res.body.data.mutation;
                const createdUser = mutation.createdUser;

                assert.strictEqual(mutation.clientMutationId, '1');
                assert.strictEqual(createdUser.name, 'TEST');
                assert.strictEqual(createdUser.mongoId, mongoId.toString());

                assert.property(createdUser, 'id');
                assert.property(createdUser, 'mongoId');

                return createdUser.mongoId;
              });
          })
          .then((userMongoId) => {
            // Query the created user
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                user (id: "${userMongoId}") {
                  mongoId
                  name
                  dynamic
                  _classVersion
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.user');
                const user = res.body.data.user;

                assert.strictEqual(user.mongoId, userMongoId);
                assert.strictEqual(user.name, 'TEST');
                assert.strictEqual(user._classVersion, projectData.classes.version);

                assert.isObject(user.dynamic);
                assert.deepEqual(user.dynamic, dynamicData);
              });
          });
      });
    });

    describe('Remove & Recover', () => {
      it('should remove and recover a news', () => {
        return Promise.resolve()
          .then(() => {
            return request(app)
              .post('/graphql')
              .set('X-Mutation', 'allow')
              .set('Content-Type', 'application/json')
              .send({
                query: `mutation {
                mutation: removeNews (input: {
                  id: "${news1._id}"
                  clientMutationId: "1"
                }) {
                  removedNewsId
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.mutation');
                const removedNewsId = res.body.data.mutation.removedNewsId;

                assert.strictEqual(removedNewsId, news1._id.toString());
              });
          })
          .then(() => {
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                news (id: "${news1._id}") {
                  mongoId
                  title
                  author {
                    mongoId
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.property(res.body, 'errors');
                assert.isNull(res.body.data.news);
              });
          })
          .then(() => {
            return request(app)
              .post('/graphql')
              .set('X-Mutation', 'allow')
              .set('Content-Type', 'application/json')
              .send({
                query: `mutation {
                mutation: recoverNews (input: {
                  id: "${news1._id}"
                  clientMutationId: "1"
                }) {
                  recoveredNews {
                    mongoId
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.mutation');
                const recoveredNews = res.body.data.mutation.recoveredNews;

                assert.strictEqual(recoveredNews.mongoId, news1._id.toString());
              });
          })
          .then(() => {
            return request(app)
              .post('/graphql')
              .set('Content-Type', 'application/json')
              .send({
                query: `{
                news (id: "${news1._id}") {
                  mongoId
                  title
                  author {
                    mongoId
                  }
                }
              }`,
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .then((res) => {
                assert.deepProperty(res, 'body.data.news');
                const news = res.body.data.news;

                assert.strictEqual(news.mongoId, news1._id.toString());
                assert.strictEqual(news.title, news1.data.title);
                assert.strictEqual(news.author.mongoId, user1._id.toString());
              });
          });
      });
    });
  });

  describe('Files', () => {
    it('should query one file metadata', () => {
      return request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({
          query: `{
            file (id: "${file1._id}") {
              mongoId
              filename
              contentType
              length
            }
          }`,
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .then((res) => {
          assert.deepProperty(res, 'body.data.file');
          const file = res.body.data.file;

          assert.strictEqual(file.mongoId, file1._id.toString());
          assert.strictEqual(file.filename, file1.filename);
          assert.strictEqual(file.contentType, file1.contentType);
        });
    });
  });
});
