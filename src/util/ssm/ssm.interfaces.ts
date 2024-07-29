/**
 * AWS SSM Parameter Response.
 */
export interface SSMParamResponse {
  /**
   * The SSM parameter.
   */
  Parameter: {
    ARN: string;
    DataType: string;
    LastModifiedDate: string;
    Name: string;
    Selector: string | null;
    SourceResult: string | null;
    Type: 'String | StringList | SecureString';
    Value: string;
    Version: number;
  }
}
