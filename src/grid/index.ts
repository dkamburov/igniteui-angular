import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IgxButtonModule } from "../button/button.directive";
import { IgxDatePickerModule } from "../date-picker/date-picker.component";
import { IgxRippleModule } from "../directives/ripple.directive";
import { IgxIconModule } from "../icon/icon.component";
import { IgxInput } from "../input/input.directive";
import { IgxGridAPIService } from "./api.service";
import { IgxGridCellComponent } from "./cell.component";
import { IgxColumnComponent } from "./column.component";
import { IgxGridFilterComponent } from "./grid-filtering.component";
import { IgxGridHeaderComponent } from "./grid-header.component";
import { IgxGridHeaderRowComponent } from "./header-row.component";
import {
  IgxCellFooterTemplateDirective,
  IgxCellHeaderTemplateDirective,
  IgxCellTemplateDirective
} from "./grid.common";
import { IgxGridComponent } from "./grid.component";
import { IgxGridFilterConditionPipe, IgxGridFilteringPipe, IgxGridPagingPipe, IgxGridSortingPipe } from "./grid.pipes";
import { IgxGridRowComponent } from "./row.component";
import { IgxVirtualContainerModule } from "../virtual-container";

@NgModule({
  declarations: [
    IgxGridCellComponent,
    IgxColumnComponent,
    IgxGridComponent,
    IgxGridRowComponent,
    IgxGridHeaderComponent,
    IgxGridHeaderRowComponent,
    IgxCellFooterTemplateDirective,
    IgxCellHeaderTemplateDirective,
    IgxCellTemplateDirective,
    IgxGridFilterComponent,
    IgxGridSortingPipe,
    IgxGridPagingPipe,
    IgxGridFilteringPipe,
    IgxGridFilterConditionPipe
  ],
  entryComponents: [
    IgxColumnComponent,
    IgxGridRowComponent,
    IgxGridCellComponent,
    IgxGridHeaderComponent,
    IgxGridHeaderRowComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    IgxButtonModule,
    IgxDatePickerModule,
    IgxIconModule,
    IgxRippleModule,
    IgxInput,
    IgxVirtualContainerModule
  ],
  exports: [
    IgxGridComponent,
    IgxGridCellComponent,
    IgxGridRowComponent,
    IgxColumnComponent,
    IgxGridHeaderComponent,
    IgxGridHeaderRowComponent,
    IgxGridFilterComponent,
    IgxCellFooterTemplateDirective,
    IgxCellHeaderTemplateDirective,
    IgxCellTemplateDirective
  ],
  providers: [IgxGridAPIService]
})
export class IgxGridModule {
  public static forRoot() {
    return {
      ngModule: IgxGridModule,
      providers: [IgxGridAPIService],
      entryComponents:[IgxGridRowComponent, IgxGridCellComponent, IgxGridHeaderComponent, IgxGridHeaderRowComponent]
    };
  }
}
