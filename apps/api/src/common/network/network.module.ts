import { Global, Module } from '@nestjs/common';
import { SafeHttpClient } from './safe-http.client';
import { UrlSafetyService } from './url-safety.service';

@Global()
@Module({
  providers: [UrlSafetyService, SafeHttpClient],
  exports: [UrlSafetyService, SafeHttpClient],
})
export class NetworkModule {}
