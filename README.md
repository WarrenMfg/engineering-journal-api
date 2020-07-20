*URL password parameter is temporary for internal development purposes only.*

| Method | Target      | Endpoint                                                     | Body                              | Returns                      |
|--------|-------------|--------------------------------------------------------------|:---------------------------------:|------------------------------|
| GET    | resources   | `/api/resources/:password/:collection`                       | \-\-                              | resources and topics         |
| GET    | collections | `/api/collections/:password`                                 | \-\-                              | topics                       |
| POST   | resource    | `/api/resource/:password/:collection`                        | description, keywords, and link   | resource                     |
| POST   | collection  | `/api/collection/:password`                                  | topic                             | new topic and all topics     |
| PUT    | resource    | `/api/resource/add-pin/:password/:collection/:id`            | \-\-                              | pinned resource              |
| PUT    | resource    | `/api/resource/remove-pin/:password/:collection/:id`         | \-\-                              | unpinned resource            |
| PUT    | resource    | `/api/resource/:password/:fromCollection/:toCollection/:id`  | \-\-                              | resource                     |
| PUT    | collection  | `/api/collection/:password/:fromCollection/:toCollection`    | \-\-                              | updated topic and all topics |
| DELETE | resource    | `/api/resource/:password/:collection/:id`                    | \-\-                              | deleted resource             |
| DELETE | collection  | `/api/collection/:password/:collection`                      | \-\-                              | acknowledgement              |