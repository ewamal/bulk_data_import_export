import {
  userRecordSchema,
  articleRecordSchema,
  commentRecordSchema,
} from '../../app/schemas/importSchemas';

describe('Import Schemas', () => {
  describe('userRecordSchema', () => {
    test('should validate valid user record', () => {
      const validUser = {
        id: '5864905b-ec8c-4fa6-8ba7-545d13f29b4e',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'admin',
        active: true,
      };

      const result = userRecordSchema.parse(validUser);
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBe('John Doe');
      expect(result.role).toBe('admin');
    });

    test('should validate user with integer id', () => {
      const user = {
        id: 123,
        email: 'user@example.com',
        name: 'John Doe',
      };

      const result = userRecordSchema.parse(user);
      expect(result.id).toBe(123);
    });

    test('should require email', () => {
      const invalidUser = {
        name: 'John Doe',
      };

      expect(() => userRecordSchema.parse(invalidUser)).toThrow();
    });

    test('should require name', () => {
      const invalidUser = {
        email: 'user@example.com',
      };

      expect(() => userRecordSchema.parse(invalidUser)).toThrow();
    });

    test('should validate email format', () => {
      const invalidUser = {
        email: 'not-an-email',
        name: 'John Doe',
      };

      expect(() => userRecordSchema.parse(invalidUser)).toThrow();
    });

    test('should default active to true', () => {
      const user = {
        id: '123',
        email: 'user@example.com',
        name: 'John Doe',
      };

      const result = userRecordSchema.parse(user);
      expect(result.active).toBe(true);
    });
  });

  describe('articleRecordSchema', () => {
    test('should validate valid article record', () => {
      const validArticle = {
        id: '33e0ef10-374c-4c7c-839c-58d8a772c143',
        slug: 'test-article',
        title: 'Test Article',
        body: 'Article body content',
        author_id: '225e7529-b0be-4dcd-bce9-07caaf0fa1cb',
        status: 'published',
      };

      const result = articleRecordSchema.parse(validArticle);
      expect(result.slug).toBe('test-article');
      expect(result.title).toBe('Test Article');
    });

    test('should validate slug kebab-case', () => {
      const validArticle = {
        slug: 'my-article-slug',
        title: 'Title',
        body: 'Body',
        author_id: 1,
      };

      expect(() => articleRecordSchema.parse(validArticle)).not.toThrow();
    });

    test('should reject invalid slug format', () => {
      const invalidArticle = {
        slug: 'Invalid Slug With Spaces',
        title: 'Title',
        body: 'Body',
        author_id: 1,
      };

      expect(() => articleRecordSchema.parse(invalidArticle)).toThrow();
    });

    test('should require author_id', () => {
      const invalidArticle = {
        slug: 'test-article',
        title: 'Title',
        body: 'Body',
      };

      expect(() => articleRecordSchema.parse(invalidArticle)).toThrow();
    });

    test('should reject draft with published_at', () => {
      const invalidArticle = {
        slug: 'test-article',
        title: 'Title',
        body: 'Body',
        author_id: 1,
        status: 'draft',
        published_at: '2024-01-01T00:00:00Z',
      };

      expect(() => articleRecordSchema.parse(invalidArticle)).toThrow(
        'Draft articles must not have published_at'
      );
    });

    test('should allow published with published_at', () => {
      const validArticle = {
        slug: 'test-article',
        title: 'Title',
        body: 'Body',
        author_id: 1,
        status: 'published',
        published_at: '2024-01-01T00:00:00Z',
      };

      expect(() => articleRecordSchema.parse(validArticle)).not.toThrow();
    });
  });

  describe('commentRecordSchema', () => {
    test('should validate valid comment record', () => {
      const validComment = {
        id: 'cm_123',
        article_id: '8fce7dc5-09d1-4ad3-ac40-64a79e78bd38',
        user_id: 'd20181f9-7a30-43e9-8c79-b9d0d2e77edf',
        body: 'This is a comment',
      };

      const result = commentRecordSchema.parse(validComment);
      expect(result.article_id).toBe('8fce7dc5-09d1-4ad3-ac40-64a79e78bd38');
      expect(result.user_id).toBe('d20181f9-7a30-43e9-8c79-b9d0d2e77edf');
      expect(result.body).toBe('This is a comment');
    });

    test('should require article_id', () => {
      const invalidComment = {
        user_id: 1,
        body: 'Comment',
      };

      expect(() => commentRecordSchema.parse(invalidComment)).toThrow();
    });

    test('should require user_id', () => {
      const invalidComment = {
        article_id: 1,
        body: 'Comment',
      };

      expect(() => commentRecordSchema.parse(invalidComment)).toThrow();
    });

    test('should require body', () => {
      const invalidComment = {
        article_id: 1,
        user_id: 1,
      };

      expect(() => commentRecordSchema.parse(invalidComment)).toThrow();
    });

    test('should validate body max length (2500 chars)', () => {
      const validComment = {
        article_id: 1,
        user_id: 1,
        body: 'a'.repeat(2500),
      };

      expect(() => commentRecordSchema.parse(validComment)).not.toThrow();
    });

    test('should reject body over max length', () => {
      const invalidComment = {
        article_id: 1,
        user_id: 1,
        body: 'a'.repeat(2501),
      };

      expect(() => commentRecordSchema.parse(invalidComment)).toThrow();
    });

    test('should accept integer IDs', () => {
      const validComment = {
        article_id: 123,
        user_id: 456,
        body: 'Comment',
      };

      expect(() => commentRecordSchema.parse(validComment)).not.toThrow();
    });
  });
});

