import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { MESSAGE_METADATA } from '@nestjs/websockets/constants';
import { IS_PUBLIC, POLICY } from './decorators';

/**
 * Boot-time safety net (DECISIONS D-011): every HTTP route and every WebSocket message handler must declare
 * @Public() or @Policy(). The app refuses to start otherwise, so a forgotten guard can't ship.
 */
@Injectable()
export class RouteAuditService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RouteAuditService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const missing = this.findUndeclared();
    if (missing.length > 0) {
      throw new Error(`Routes without @Public()/@Policy(): ${missing.join(', ')}`);
    }
    this.logger.log('All routes and socket handlers declare an access policy');
  }

  findUndeclared(): string[] {
    const missing: string[] = [];
    const wrappers = [...this.discovery.getControllers(), ...this.discovery.getProviders()];
    for (const wrapper of wrappers) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const proto = Object.getPrototypeOf(instance) as object;
      const isController = this.discovery.getControllers().includes(wrapper);
      for (const name of this.scanner.getAllMethodNames(proto)) {
        const handler = (proto as Record<string, unknown>)[name] as object;
        const isRoute = isController && Reflect.hasMetadata(PATH_METADATA, handler);
        const isSocket = Reflect.hasMetadata(MESSAGE_METADATA, handler);
        if (!isRoute && !isSocket) continue;
        const targets = [handler, instance.constructor as object] as (() => void)[];
        const declared =
          this.reflector.getAllAndOverride(IS_PUBLIC, targets) ||
          this.reflector.getAllAndOverride(POLICY, targets);
        if (!declared) missing.push(`${(instance.constructor as { name: string }).name}.${name}`);
      }
    }
    return missing;
  }
}
