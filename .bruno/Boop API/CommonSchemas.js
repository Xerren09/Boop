const eventLogDirHandleSchema = {
      type: "object",
      properties: {
          time: { type: "integer" },
          dir: { type: "string" },
          eventReference: { type: "string", format: "uuid"}
      },
      additionalProperties: false,
      required: ["time", "dir"]
};

const webhookEventSchema = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        type: { type: "string" },
        time: { type: "integer" },
        repository: {
            type: "object",
            properties: {
                url: { type: "string", format: "uri"},
                branch: { type: "string" },
                name: { type: "string" },
                owner: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        url: { type: "string", format: "uri" }
                    },
                    additionalProperties: false,
                    get required() {
                      return Object.keys(this.properties)
                    }
                }
            },
            additionalProperties: false,
            get required() {
              return Object.keys(this.properties)
            }
        },
        commit: {
            type: "object",
            properties: {
                id: { type: "string" },
                url: { type: "string", format: "uri" },
            },
            additionalProperties: false,
            get required() {
              return Object.keys(this.properties)
            }
        },
        security: {
            type: "object",
            properties: {
                hash: { type: "string" },
                valid: { type: "boolean" }
            },
            additionalProperties: false,
            get required() {
              return Object.keys(this.properties)
            }
        },
        sender: {
            type: "object",
            properties: {
                name: { type: "string" },
                url: { type: "string", format: "uri" },
            },
            additionalProperties: false,
            get required() {
              return Object.keys(this.properties)
            }
        }
    },
    additionalProperties: false,
    get required() {
      return Object.keys(this.properties)
    }
};

const projectTypeSchema = {
  type: "string",
  enum: ["webapp", "service"]
}

module.exports = {
  eventLogDirHandleSchema,
  webhookEventSchema,
  projectTypeSchema
}